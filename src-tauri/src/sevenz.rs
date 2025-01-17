use std::{
    collections::HashMap,
    fs, io,
    num::NonZeroUsize,
    path::{Path, PathBuf},
    process::{Command, Output},
    sync::{LazyLock, Mutex, MutexGuard, OnceLock},
};

use codepage::{
    is_halfwidth_katakana, is_latin_capital_letter, is_replacement_character, Codepage,
    OptionalCodepage,
};
use lru::LruCache;
use regex::Regex;
use serde::{Deserialize, Serialize};
use specta::Type;
use strum::{Display, EnumIter, IntoEnumIterator, VariantNames};
use tauri_plugin_http::reqwest;
use time::{format_description::well_known::Iso8601, OffsetDateTime, PrimitiveDateTime};
use time_tz::{system::get_timezone, PrimitiveDateTimeExt};

use crate::config;
use error::SevenzError;
use fs_tree::ArchiveContents;
use multi_volume::{archive_multi_volume, get_first_volume};

pub mod codepage;
pub mod delete;
pub mod error;
pub mod fs_tree;
pub mod multi_volume;
pub mod unzip;

static SEVENZ_COMMAND: LazyLock<Mutex<Option<String>>> = LazyLock::new(|| {
    let command = if cfg!(windows) {
        "7z".to_string() // Windows 路径
    } else if cfg!(unix) {
        "7zz".to_string() // Linux, macOS 路径
    } else {
        panic!("Unsupported operating system");
    };
    Mutex::new(match Command::new(&command).output() {
        Ok(_) => Some(command),
        Err(_) => None,
    })
});

/// Returns the local path of the 7z command.
///
/// If the 7z command was not found in the system path, it will look for the 7z command in the
/// `config_dir` directory. If the 7z command is found, it will be stored in the `SEVENZ_COMMAND`
/// global variable.
///
/// # Note
///
/// The 7z command will be looked for in the following directories:
///
/// - Windows: `config_dir/7z-extra/7za.exe`
/// - macOS: `config_dir/7z-macos/7zz`
/// - Linux: `config_dir/7z-linux/7zz`
///
/// # Errors
///
/// If the 7z command is not found in the system path or in the `config_dir` directory, it will
/// return `None`.
fn sevenz_command_local(config_dir: &Path) -> Option<String> {
    let mut command = SEVENZ_COMMAND.lock().unwrap();
    if (*command).is_none() {
        let path = if cfg!(windows) {
            config_dir.join("7z-extra").join("7za.exe")
        } else if cfg!(target_os = "macos") {
            config_dir.join("7z-macos").join("7zz")
        } else if cfg!(target_os = "linux") {
            config_dir.join("7z-linux").join("7zz")
        } else {
            panic!("Unsupported operating system");
        };
        if Command::new(&path).output().is_ok() {
            *command = Some(path.to_str().unwrap().to_string())
        }
    };
    command.clone()
}

/// Returns a `Command` instance with the path of the 7z command.
///
/// If the 7z command is not found in the system path, it will search for the 7z command in the
/// `config_dir` directory. If the 7z command is found, it will be stored in the `SEVENZ_COMMAND`
/// global variable.
///
/// # Errors
///
/// If the 7z command is not found in the system path or in the `config_dir` directory, it will
/// return `Err(SevenzError::NotFound7z)`.
pub fn sevenz_command() -> Result<Command, SevenzError> {
    let Some(sevenz_command) = SEVENZ_COMMAND.lock().unwrap().clone() else {
        return Err(SevenzError::NotFound7z);
    };
    Ok(Command::new(sevenz_command))
}

static MAP: OnceLock<Mutex<HashMap<PathBuf, bool>>> = OnceLock::new();
/// 保存压缩文件是否有根文件夹.
/// 如果没有根文件夹, 会在解压时自动创建根文件夹.
pub fn archives_have_root_dir() -> MutexGuard<'static, HashMap<PathBuf, bool>> {
    // https://www.reddit.com/r/rust/comments/18x9nxg/how_do_i_make_a_global_mutable_hashmap/
    MAP.get_or_init(|| Mutex::new(HashMap::new())) // can use `Default::default`.
        .lock()
        .expect("Let's hope the lock isn't poisoned")
}

type FilesModified = HashMap<String, Option<OffsetDateTime>>;

static FILES_MODIFIED: LazyLock<Mutex<LruCache<PathBuf, FilesModified>>> =
    LazyLock::new(|| Mutex::new(LruCache::new(NonZeroUsize::new(1_000).unwrap())));

// 验证 7zip 命令行工具是否安装.
pub fn check_7z_version(config_dir: &Path) -> Result<String, SevenzError> {
    let binding = SEVENZ_COMMAND.lock().unwrap().clone();
    let sevenz_command = match binding {
        Some(sevenz_command) => sevenz_command,
        None => match sevenz_command_local(config_dir) {
            Some(sevenz_command) => sevenz_command,
            None => return Err(SevenzError::NotFound7z),
        },
    };

    match Command::new(sevenz_command).arg("-h").output() {
        Ok(output) => {
            if output.status.success() {
                let output_str = String::from_utf8_lossy(&output.stdout);
                // 解析版本信息，7-Zip 的帮助信息中包含版本字符串
                if let Some(version_line) =
                    output_str.lines().find(|line| line.starts_with("7-Zip"))
                {
                    Ok(format!("7-Zip 已安装: {}", version_line))
                } else {
                    Err(SevenzError::CommandError(
                        "7-Zip 已安装，但版本信息解析失败。".to_string(),
                    ))
                }
            } else {
                Err(SevenzError::NotFound7z)
            }
        }
        Err(err) => Err(err.into()),
    }
}

pub async fn download_7z(config_dir: &Path) -> Result<(), SevenzError> {
    let res = reqwest::get("https://7-zip.org/download.html")
        .await?
        .text()
        .await?;
    let suffix = if cfg!(windows) {
        "extra.7z"
    } else if cfg!(target_os = "macos") {
        "mac.tar.xz"
    } else if cfg!(target_os = "linux") {
        "linux-x64.tar.xz"
    } else {
        panic!("Unsupported operating system");
    };
    let re = Regex::new(&format!(r#"href="a/(7z[0-9.]+-{suffix})""#)).unwrap();
    if let Some(link) = re.captures(&res) {
        if let Some(filename) = link.get(1) {
            let downlowd_link = format!("https://7-zip.org/a/{}", filename.as_str());
            let mut res = reqwest::get(&downlowd_link).await?;
            if !config_dir.exists() {
                fs::create_dir(config_dir)?;
            }
            let file_path = config_dir.join(filename.as_str());
            {
                let mut dest = fs::File::create(&file_path)?;
                while let Some(chunk) = res.chunk().await? {
                    io::copy(&mut chunk.as_ref(), &mut dest)?;
                }
            }

            let dir_name = if cfg!(windows) {
                "7z-extra"
            } else if cfg!(target_os = "macos") {
                "7z-macos"
            } else if cfg!(target_os = "linux") {
                "7z-linux"
            } else {
                "7z-unknown"
            };

            let target_dir = config_dir.join(dir_name);
            if !target_dir.exists() {
                fs::create_dir(&target_dir)?;
            }

            let output = Command::new("tar")
                .arg("-xvf")
                .arg(&file_path)
                .arg("-C")
                .arg(config_dir.join(dir_name))
                .output()?;
            fs::remove_file(&file_path)?;
            if output.status.success() {
                sevenz_command_local(config_dir);
            } else {
                return Err(SevenzError::CommandError(format!(
                    "解压 7-Zip 失败: {}",
                    String::from_utf8_lossy(&output.stderr)
                )));
            }
        }
    }
    Ok(())
}

#[derive(Serialize, Deserialize, Debug, Clone, Type)]
pub struct Archive {
    pub path: PathBuf,
    pub password: Option<String>,
    pub codepage: OptionalCodepage,
}

// 显示压缩文件内容.
pub fn show_archive_content<P: AsRef<Path>>(
    archive_path: P,
    password: &str,
    codepage: OptionalCodepage,
    app_config: &config::AppConfig,
) -> Result<ArchiveContents, SevenzError> {
    let mut file_path = archive_path.as_ref().to_path_buf();
    // 判断文件是否是文件夹.
    if !file_path.is_file() {
        return Err(SevenzError::UnsupportedFile(file_path));
    }

    let first_volume = get_first_volume(&file_path);
    if let Some(multi_volume) = first_volume {
        file_path = multi_volume;
    }

    let wrap_result = |mut result: ArchiveContents| {
        if result.is_multi_volume() {
            result.set_actual_path(archive_path.as_ref().to_path_buf());
        }
        Ok(result)
    };

    let mut current_password = password.to_owned();
    let mut result = sevenz_list_command(&file_path, &current_password, codepage.clone());
    if let Ok(result) = result {
        return wrap_result(result);
    }

    let mut passwords = app_config.passwords().into_iter().peekable();
    let mut codepages = Codepage::iter().peekable();

    loop {
        match result {
            Ok(result) => return wrap_result(result),
            Err(e) => match e {
                SevenzError::NeedPassword(_) if passwords.peek().is_some() => {
                    let password = passwords.next().unwrap();
                    current_password = password;
                    result = sevenz_list_command(&file_path, &current_password, codepage.clone());
                }
                SevenzError::InvalidUtf8(ref s) if codepages.peek().is_some() => {
                    println!("error string: {}", s);
                    let codepage = codepages.next().unwrap();
                    result = sevenz_list_command(&file_path, &current_password, codepage.into());
                }
                _ => return Err(e),
            },
        }
    }
}

const LIST_COMMAND_ARGS: [&str; 3] = ["l", "-slt", "-sccUTF-8"];

pub struct OutputFile {
    path: String,
    is_dir: bool,
    modified: Option<OffsetDateTime>,
}

impl OutputFile {
    pub fn cache_modified(&self, archive_path: PathBuf) {
        let mut binding = FILES_MODIFIED.lock().unwrap();
        let map = binding.get_or_insert_mut(archive_path, FilesModified::new);
        map.insert(self.path.clone(), self.modified);
    }
}

#[derive(Display, EnumIter)]
enum Prefix {
    Path,
    Folder,
    Attributes,
    Modified,
    Volumes,
}

#[derive(Display, VariantNames)]
enum LineType {
    Path(String),
    Folder(bool),
    Attributes(bool),
    Modified(OffsetDateTime),
    Volumes(usize),
}

impl LineType {
    /// Creates a new `LineType` based on the line's prefix.
    ///
    /// This function iterates over the defined prefixes and checks if the given line
    /// starts with any of them. If a match is found, it returns the corresponding
    /// `LineType` by invoking the `_new` function with the matched prefix and line.
    ///
    /// # Arguments
    ///
    /// * `line` - A string slice that holds the line to be evaluated.
    ///
    /// # Returns
    ///
    /// * `Option<LineType>` - Returns `Some(LineType)` if a prefix match is found,
    ///   otherwise returns `None`.
    fn new(line: &str) -> Option<LineType> {
        Prefix::iter().find_map(|prefix| {
            let prefix_s = prefix.to_string();
            if !line.starts_with(&prefix_s) {
                return None;
            }

            let prefix_full = format!("{} = ", prefix_s);
            let value = line.replace(&prefix_full, "");
            Some(match prefix {
                Prefix::Path => LineType::Path(value),
                Prefix::Folder => LineType::Folder(value == "+"),
                Prefix::Attributes => LineType::Attributes(value.starts_with("D")),
                Prefix::Modified => {
                    let date = value.replace(" ", "T");
                    // date.push('Z'); PrimitiveDateTime not need timezone, but OffsetDateTime need.
                    let datetime = PrimitiveDateTime::parse(&date, &Iso8601::DEFAULT).unwrap();
                    let offset_datetime = datetime.assume_timezone_utc(get_timezone().unwrap());
                    LineType::Modified(offset_datetime)
                }
                Prefix::Volumes => LineType::Volumes(value.parse().unwrap()),
            })
        })
    }
}

fn sevenz_list_command<P: AsRef<Path>>(
    archive_path: P,
    password: &str,
    codepage: OptionalCodepage,
) -> Result<fs_tree::ArchiveContents, SevenzError> {
    let output = sevenz_list_command_output(&archive_path, password, codepage.clone());
    match output {
        Ok(s) => {
            let mut archive = ArchiveContents::new(archive_path.as_ref().to_path_buf());

            let mut lines = s.lines();
            lines
                .by_ref()
                .take_while(|line| *line != "----------")
                .for_each(|line| {
                    let line_type = LineType::new(line);
                    if let Some(LineType::Volumes(volumes @ 2..)) = line_type {
                        let multi_volume = archive_multi_volume(&archive_path, volumes);
                        archive.set_multi_volume(multi_volume);
                    }
                });

            let groups = lines
                // TODO: take_while skip_while 是否包含 "----------"?
                // .skip_while(|line| *line != "----------")
                // .skip(1) // 跳过 "----------".
                .fold(vec![vec![]], |mut groups, line| {
                    if line.is_empty() {
                        groups.push(vec![]);
                    } else {
                        groups.last_mut().unwrap().push(line);
                    }
                    groups
                });
            let output_files = groups.iter().map(|group| {
                let mut path: String = "".to_string();
                let mut is_dir: bool = false;
                let mut modified: Option<OffsetDateTime> = None;
                for line in group {
                    match LineType::new(line) {
                        Some(LineType::Path(s)) => {
                            let check = s
                                .chars()
                                .filter(|c| {
                                    is_replacement_character(*c)
                                        || is_halfwidth_katakana(*c)
                                        || is_latin_capital_letter(*c)
                                })
                                .count();
                            let chars_count = s.chars().count();
                            if check as f64 / chars_count as f64 > 0.5 {
                                return Err(SevenzError::InvalidUtf8(s.to_owned()));
                            };
                            path = s;
                        }
                        Some(LineType::Folder(b) | LineType::Attributes(b)) => {
                            is_dir |= b;
                        }
                        Some(LineType::Modified(datetime)) => {
                            modified = Some(datetime);
                        }
                        Some(LineType::Volumes(_)) | None => {}
                    };
                }
                Ok(OutputFile {
                    path,
                    is_dir,
                    modified,
                })
            });

            output_files.rev().try_fold(
                // NOTE: try_fold
                &mut archive,
                |tree, file| match file {
                    Ok(file) => {
                        file.cache_modified(archive_path.as_ref().to_path_buf());
                        tree.append_file(file);
                        Ok(tree)
                    }
                    Err(e) => Err(e),
                },
            )?;
            archive.sort();
            archive.set_password(password);
            archive.set_codepage(codepage);
            archive.set_has_root_dir();

            Ok(archive)
        }
        Err(e) => Err(e),
    }
}

fn sevenz_list_command_output<P: AsRef<Path>>(
    archive_path: P,
    password: &str,
    codepage: OptionalCodepage,
) -> Result<String, SevenzError> {
    let mut command = sevenz_command()?;
    command.args(LIST_COMMAND_ARGS);
    if !password.is_empty() {
        command.set_password(password);
    }
    if let Some(mcp) = codepage {
        println!("mcp: {}", mcp);
        command.arg(mcp.to_string());
    }
    command.arg(archive_path.as_ref());
    let output = command.output();
    match output {
        Ok(output) => {
            if output.status.success() {
                Ok(String::from_utf8_lossy(&output.stdout).to_string())
            } else if need_password(&output) || wrong_password(&output) {
                Err(SevenzError::NeedPassword(
                    archive_path.as_ref().as_os_str().into(),
                ))
            } else {
                Err(SevenzError::CommandError(
                    String::from_utf8_lossy(&output.stderr).to_string(),
                ))
            }
        }
        Err(err) => Err(SevenzError::CommandError(err.to_string())),
    }
}

trait PasswordCommand {
    fn set_password(&mut self, password: &str);
}

impl PasswordCommand for Command {
    fn set_password(&mut self, password: &str) {
        let password = format!(r#"-p{password}"#);
        self.arg(password);
    }
}

// 判断是否需要密码输入.
fn need_password(output: &Output) -> bool {
    let output_str = String::from_utf8_lossy(&output.stdout);
    output.status.code() == Some(255) && output_str.contains("Enter password")
}

fn wrong_password(output: &Output) -> bool {
    let output_str = String::from_utf8_lossy(&output.stderr);
    output.status.code() == Some(2) && output_str.contains("Wrong password?")
}
