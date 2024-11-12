use std::{
    collections::HashMap, ffi::OsString, path::PathBuf, process::{Command, Output}, sync::{Mutex, MutexGuard, OnceLock}
};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use serde::Serialize;

pub mod fs_tree;
pub mod unzip;

/// 保存压缩文件是否有根文件夹.
/// 如果没有根文件夹, 会在解压时自动创建根文件夹.
pub fn archives_have_root_folder() -> MutexGuard<'static, HashMap<PathBuf, bool>> {
    // https://www.reddit.com/r/rust/comments/18x9nxg/how_do_i_make_a_global_mutable_hashmap/
    static MAP: OnceLock<Mutex<HashMap<PathBuf, bool>>> = OnceLock::new();
    MAP.get_or_init(|| Mutex::new(HashMap::new())) // can use `Default::default`.
        .lock()
        .expect("Let's hope the lock isn't poisoned")
}

// 验证 7zip 命令行工具是否安装.
pub fn check_7z_version() -> String {
    let output = Command::new("7z").arg("-h").output();

    match output {
        Ok(output) => {
            if output.status.success() {
                let output_str = String::from_utf8_lossy(&output.stdout);
                // 解析版本信息，7-Zip 的帮助信息中包含版本字符串
                if let Some(version_line) =
                    output_str.lines().find(|line| line.starts_with("7-Zip"))
                {
                    format!("7-Zip 已安装: {}", version_line)
                } else {
                    "7-Zip 已安装，但版本信息解析失败。".to_string()
                }
            } else {
                "7-Zip 未安装或不在 PATH 中。".to_string()
            }
        }
        Err(err) => {
            format!("执行 7z 命令时出错: {}", err)
        }
    }
}

// 显示压缩文件内容.
pub fn show_archive_content(file_path: &PathBuf) -> Result<fs_tree::ArchiveTree, SevenzError> {
    let result = sevenz_list_command(file_path, "");
    match result {
        Ok(ref s) => {
            println!("{}", s);
        }
        Err(ref e) => {
            println!("{}", e)
        }
    }
    result
}

const LIST_COMMAND_ARGS: [&str; 3] = ["l", "-slt",  "-sccUTF-8"];

#[derive(Debug, Serialize)]
pub enum SevenzError {
    NeedPassword(OsString),
    CommandError(String),
}

impl std::fmt::Display for SevenzError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SevenzError::NeedPassword(msg) => write!(f, "需要密码输入:{:?}", msg),
            SevenzError::CommandError(msg) => write!(f, "{}", msg),
        }
    }
}

struct OutputFile {
    path: String,
    is_dir: bool,
}

enum LineType {
    Path(String),
    Folder(bool),
    Attributes(bool),
    None,
}

impl LineType {
    const PREFIX: [&str; 3] = ["Path = ", "Folder = ", "Attributes = "];

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
        Self::PREFIX.iter().find_map(|prefix| {
            if line.starts_with(prefix) {
                Some(LineType::_new(prefix, line))
            } else {
                None
            }
        })
    }

    /// Creates a new `LineType` based on the provided prefix and line.
    ///
    /// # Arguments
    ///
    /// * `prefix` - A string slice representing the prefix of the line.
    /// * `line` - A string slice of the full line to be parsed.
    ///
    /// # Returns
    ///
    /// * `LineType` - Returns the corresponding `LineType` variant based on the prefix.
    fn _new(prefix: &str, line: &str) -> LineType {
        match prefix {
            "Path = " => LineType::Path(line.replace(prefix, "")),
            "Folder = " => LineType::Folder(line.replace(prefix, "") == "+"),
            "Attributes = " => LineType::Attributes(line.replace(prefix, "") == "D"),
            _ => LineType::None,
        }
    }
}

fn sevenz_list_command(
    file_path: &PathBuf,
    password: &str,
) -> Result<fs_tree::ArchiveTree, SevenzError> {
    let output = sevenz_list_command_output(file_path, password);
    match output {
        Ok(s) => {
            let groups = s
                .lines()
                .skip_while(|line| *line != "----------")
                .skip(1) // 跳过 "----------".
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
                for line in group {
                    match LineType::new(line) {
                        Some(LineType::Path(s)) => {
                            path = s;
                        }
                        Some(LineType::Folder(b) | LineType::Attributes(b)) => {
                            is_dir = b;
                        }
                        Some(LineType::None) | None => {}
                    };
                }
                OutputFile { path, is_dir }
            });

            let tree = output_files.fold(
                fs_tree::ArchiveTree::new(file_path.to_path_buf()),
                |mut tree, file| {
                    tree.append_path(file.path, file.is_dir);
                    tree
                },
            );
            tree.set_has_root_folder();
            Ok(tree)
        }
        Err(e) => Err(e),
    }
}

fn sevenz_list_command_output(file_path: &PathBuf, password: &str) -> Result<String, SevenzError> {
    let mut command = Command::new("7z");
    command.args(LIST_COMMAND_ARGS);
    if password.is_empty() {
    } else {
        set_password(&mut command, password);
    }
    command.arg(file_path);
    let output = command.output();

    match output {
        Ok(output) => {
            if output.status.success() {
                return Ok(String::from_utf8_lossy(&output.stdout).to_string());
            } else if need_password(&output) {
                for password in ["misskon.com"] {
                    if !password.is_empty() {
                        if let Ok(s) = sevenz_list_command_output(file_path, password) {
                            return Ok(s);
                        }
                    }
                }
                return Err(SevenzError::NeedPassword(file_path.as_os_str().into()));
            } else {
                return Err(SevenzError::CommandError(
                    String::from_utf8_lossy(&output.stdout).to_string(),
                ));
            }
        }
        Err(err) => Err(SevenzError::CommandError(err.to_string())),
    }
}

#[cfg(target_os = "windows")]
fn set_password(command: &mut Command, password: &str) {
    let password = format!(r#"-p"{password}""#);
    command.raw_arg(password); // 将字面量文本追加到命令行，无需任何引用或转义.
}

#[cfg(not(target_os = "windows"))]
fn set_password(command: &mut Command, password: &str) {
    let password = format!(r#"-p"{password}""#);
    command.arg(password);
}

// 判断是否需要密码输入.
fn need_password(output: &Output) -> bool {
    let output_str = String::from_utf8_lossy(&output.stdout);
    output_str.contains("Enter password")
}
