use std::{
    fs::{self, File, FileTimes},
    path::{Component, Path, PathBuf},
    process::{Command, Stdio},
    sync::mpsc,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use notify::{event, RecursiveMode, Watcher};
use notify_debouncer_full::{new_debouncer, DebounceEventResult, Debouncer, FileIdCache};
use regex::Regex;
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri_specta::Event;
use unicode_normalization::UnicodeNormalization;
use walkdir::WalkDir;

use super::{archives_have_root_dir, sevenz_command, Archive, FilesModified, PasswordCommand};
use crate::config;

#[derive(Serialize, Deserialize, Debug, Clone, Type, Event)]
pub enum UnzipedArchiveStatus {
    Ok(PathBuf),
    Running,
    Completed,
}

pub fn unzip(
    archive: Archive,
    target_dir: &PathBuf,
    global_password: &Option<String>,
    app_config: &config::AppConfig,
    sender: &mpsc::Sender<(PathBuf, UnzipedArchiveStatus)>,
) {
    let mut changed = false;
    let target = target_dir
        .iter()
        .map(|s| {
            let bytes = s.as_encoded_bytes();
            let mut iter = bytes.iter();
            let index = iter.rposition(|&b| b != b' ');
            if let Some(i) = index {
                changed = true;
                &bytes[..=i]
            } else {
                bytes
            }
        })
        .collect::<Vec<_>>();
    let target_dir = if changed {
        &PathBuf::from_iter(
            target
                .into_iter()
                .filter_map(|b| String::from_utf8(b.to_vec()).ok()),
        )
    } else {
        target_dir
    };

    sender
        .send((archive.path.to_owned(), UnzipedArchiveStatus::Running))
        .unwrap();

    let password = match archive.password {
        None => global_password.to_owned(),
        _ => archive.password.clone(),
    };
    if !sevenz_extract(&archive, target_dir, password, sender) {
        // TODO: password error
        for password in app_config.passwords() {
            if !sevenz_extract(&archive, target_dir, password.into(), sender) {
                continue;
            }
        }
    }
}

const EXTRACT_COMMAND_ARGS: [&str; 3] = ["x", "-aou", "-sccUTF-8"];
const TEST_COMMAND_ARGS: [&str; 2] = ["t", "-sccUTF-8"];

struct ArchiveCount {
    folder: u32,
    file: u32,
}

const FOLDERS_LINE: &str = "Folders: ";
const FILES_LINE: &str = "Files: ";

fn sevenz_test(archive: &Archive, password: Option<String>) -> Option<ArchiveCount> {
    let mut command = sevenz_command().unwrap();
    command.args(TEST_COMMAND_ARGS);
    if let Some(password) = password.filter(|p| !p.is_empty()) {
        command.set_password(&password);
    }
    command.arg(&archive.path);
    let output = command.output().unwrap();
    if matches!(output.status.code(), Some(0)) {
        let mut archive_count = ArchiveCount { folder: 0, file: 0 };
        let output = String::from_utf8_lossy(&output.stdout);
        output.lines().for_each(|line| {
            if line.starts_with(FOLDERS_LINE) {
                archive_count.folder = line.replace(FOLDERS_LINE, "").parse().unwrap();
            } else if line.starts_with(FILES_LINE) {
                archive_count.file = line.replace(FILES_LINE, "").parse().unwrap();
            }
        });
        return Some(archive_count);
    }
    None
}

fn sevenz_extract(
    archive: &Archive,
    target_dir: &PathBuf,
    password: Option<String>,
    sender: &mpsc::Sender<(PathBuf, UnzipedArchiveStatus)>,
) -> bool {
    let Some(archive_count) = sevenz_test(archive, password.to_owned()) else {
        return false;
    };
    let mut command = sevenz_command().unwrap();
    command.args(EXTRACT_COMMAND_ARGS);

    let temp_dir = TempTargetDir::new(archive.path.to_owned(), target_dir.to_owned());
    command.output_dir_arg(&temp_dir);

    if let Some(password) = password.filter(|p| !p.is_empty()) {
        command.set_password(&password);
    }

    if let Some(mcp) = &archive.codepage {
        println!("mcp: {}", mcp);
        command.arg(mcp.to_string());
    }

    command.arg(&archive.path);

    let (_watcher, rx) = temp_dir.watcher();

    let mut child = command
        .stdin(Stdio::null()) // 阻止输入密码.
        .stdout(Stdio::null())
        .spawn()
        .inspect_err(|_| {
            temp_dir.delete();
        })
        .expect("7z extract failed"); // PANIC!

    let mut folder_count = 0;
    let mut file_count = 0; // TODO: from 7z test
    let mut pre_folder = PathBuf::new();
    loop {
        match child.try_wait() {
            Ok(Some(status)) if !status.success() => {
                break;
            }
            // zip maybe lower folder.
            Ok(Some(_))
                if folder_count >= archive_count.folder && file_count == archive_count.file =>
            {
                break;
            }
            Ok(_) => (),
            Err(_) => {
                break;
            }
        }

        match rx.recv_timeout(Duration::from_millis(1000)) {
            Ok(Ok(res)) => {
                for event in res {
                    let create_kind = match event.kind {
                        event::EventKind::Create(create_kind) => create_kind,
                        _ => continue,
                    };
                    let path = event.paths.first().unwrap();
                    if *path == temp_dir.path {
                        continue;
                    }
                    let is_folder = match create_kind {
                        event::CreateKind::Folder => true,
                        event::CreateKind::File => false,
                        event::CreateKind::Any => path.is_dir(),
                        _ => true,
                    };
                    if is_folder {
                        folder_count += 1;
                        pre_folder = path.to_owned();
                    } else {
                        file_count += 1;
                        if path.parent() == Some(&pre_folder) {
                            // folder_count -= 1;
                            pre_folder = PathBuf::new();
                        }
                    }
                    sender
                        .send((
                            archive.path.clone(),
                            UnzipedArchiveStatus::Ok(temp_dir.relative_path(path)),
                        ))
                        .unwrap();
                }
            }
            _ => continue,
        };
    }

    let output = child.wait_with_output().unwrap();
    if output.status.success() {
        let _actual_path = temp_dir.remove();

        sender
            .send((archive.path.to_owned(), UnzipedArchiveStatus::Completed))
            .unwrap();
        // if let Some(actual_path) = actual_path {
        //     let actual_dir = TempTargetDir {
        //         path: actual_path,
        //         has_root_dir: temp_dir.has_root_dir,
        //     };
        //     let mut binding = FILES_MODIFIED.lock().unwrap();
        //     let modified = binding.get(&archive_path.as_ref().to_path_buf());
        //     if modified.is_some() {
        //         let modified = modified.unwrap().clone();
        //         tokio::spawn(async { water_actual_dir(actual_dir, modified).await });
        //     }
        // }
        true
    } else {
        println!("{:?} {}", output, output.status.code().unwrap());
        temp_dir.delete();
        false
    }
}

#[allow(dead_code)]
async fn water_actual_dir(target_dir: TempTargetDir, files_modified: FilesModified) {
    println!("water actual dir: {}", target_dir.path.display());
    for e in WalkDir::new(&target_dir.path) {
        let entry = e.unwrap();
        let metadata = entry.metadata().unwrap();
        let reletive_path = target_dir
            .archive_relative_path(&entry.path().into())
            .to_string_lossy()
            .nfc()
            .collect::<String>();
        let archive_modified = files_modified.get(&reletive_path);
        if let Some(Some(archive_modified)) = archive_modified {
            let archive_modified = archive_modified.unix_timestamp_nanos();
            let system_time =
                UNIX_EPOCH + Duration::from_nanos((archive_modified as u128).try_into().unwrap());
            let filetimes = FileTimes::new();
            let mut changed = false;
            if let Ok(modified) = metadata.modified() {
                println!("system time: {:?} modified: {:?}", system_time, modified);
                if modified > system_time {
                    filetimes.set_modified(system_time);
                    changed = true;
                }
            };
            if let Ok(accessed) = metadata.accessed() {
                println!("system time: {:?} accessed: {:?}", system_time, accessed);
                if accessed > system_time {
                    filetimes.set_accessed(system_time);
                    changed = true;
                }
            };
            if cfg!(any(target_os = "windows", target_os = "macos")) {
                #[cfg(target_os = "macos")]
                use std::os::macos::fs::FileTimesExt;
                #[cfg(target_os = "windows")]
                use std::os::windows::fs::FileTimesExt;

                if let Ok(created) = metadata.created() {
                    println!("system time: {:?} created: {:?}", system_time, created);
                    if created > system_time {
                        filetimes.set_created(system_time);
                        changed = true;
                    }
                }
            }
            if changed {
                File::options()
                    .write(true)
                    .open(entry.path())
                    .unwrap()
                    .set_times(filetimes)
                    .unwrap();
            }
        }
    }
    let (_watcher, rx) = target_dir.watcher();
    if let Ok(Ok(res)) = rx.recv() {
        for event in res {
            println!("{:?}", event);
        }
    };
}

struct TempTargetDir {
    pub path: PathBuf,
    has_root_dir: bool,
}

impl TempTargetDir {
    fn new(path: PathBuf, target_dir: PathBuf) -> TempTargetDir {
        // TODO: 支持相对压缩文件的路径.
        let mut temp_dir: PathBuf = if *target_dir != PathBuf::new() {
            target_dir.to_path_buf()
        } else if path.is_file() {
            path.parent().unwrap().to_path_buf()
        } else {
            path.to_path_buf()
        };
        let temp = format!(
            "_EZ{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_millis()
        );
        temp_dir.push(temp);

        if !temp_dir.exists() {
            std::fs::create_dir_all(&temp_dir).unwrap();
        }

        TempTargetDir {
            path: temp_dir,
            has_root_dir: *archives_have_root_dir().get(&path).unwrap_or(&false),
        }
    }

    fn output_path(&self) -> PathBuf {
        if self.has_root_dir {
            self.path.to_owned()
        } else {
            let mut path = self.path.to_owned();
            path.push("*");
            path
        }
    }

    fn delete(&self) -> bool {
        fs::remove_dir_all(&self.path).is_ok()
    }

    fn remove(&self) -> Option<PathBuf> {
        let temp_dir = &self.path;
        let parent_folder = temp_dir.parent().unwrap();
        let mut result = None;
        for entry in fs::read_dir(temp_dir).unwrap() {
            let entry = entry.unwrap();
            let path = entry.path();
            let sub_name = path.file_name().unwrap();
            // 如果文件夹名重复, 需要加后缀.
            let mut sub_path = parent_folder.join(sub_name);
            let mut extension = 0;
            while sub_path.try_exists().unwrap_or(false) {
                extension += 1;
                if extension == 1 {
                    // TODO: unstable add_extension
                    sub_path.as_mut_os_string().push(format!(".{extension}"));
                } else {
                    sub_path.set_extension(extension.to_string());
                }
            }
            let _ = fs::rename(path, &sub_path);
            result = Some(sub_path);
        }
        self.delete();
        result
    }

    fn watcher(
        &self,
    ) -> (
        Debouncer<impl Watcher, impl FileIdCache>,
        mpsc::Receiver<DebounceEventResult>,
    ) {
        let (tx, rx) = mpsc::channel();
        let mut debouncer = new_debouncer(Duration::from_millis(1000), None, tx).unwrap();
        debouncer
            .watch(&self.path, RecursiveMode::Recursive)
            .unwrap();
        (debouncer, rx)
    }

    fn relative_path(&self, path: &PathBuf) -> PathBuf {
        _relative_path(&self.path, path)
    }

    fn archive_relative_path(&self, path: &PathBuf) -> PathBuf {
        if !self.has_root_dir {
            self.relative_path(path)
        } else {
            let parent = self.path.parent().unwrap().to_path_buf();
            _relative_path(&parent, path)
        }
    }
}

fn _relative_path(dest: &Path, path: &PathBuf) -> PathBuf {
    let path = if dest.is_relative() {
        let itc = path.components();
        let to_parent = itc.skip_while(|c| *c != Component::ParentDir);
        &PathBuf::from_iter(to_parent)
    } else {
        path
    };
    if let Ok(relative_path) = path.strip_prefix(dest) {
        relative_path.to_owned()
    } else {
        path.clone()
    }
}

trait SevenzOutput<T> {
    fn output_dir_arg(&mut self, dir: T) -> &mut Self;
}

impl SevenzOutput<&TempTargetDir> for Command {
    fn output_dir_arg(&mut self, dir: &TempTargetDir) -> &mut Self {
        let output_dir = format!(r#"-o{}"#, dir.output_path().to_string_lossy());
        {
            self.arg(output_dir)
        }
    }
}
