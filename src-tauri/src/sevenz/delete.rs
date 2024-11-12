use std::ffi::OsStr;
use std::path::PathBuf;

use trash;

pub fn delete_archive(file_path: &PathBuf) -> Result<(), String> {
    let is_smb = is_smb_mounted(file_path.components().next().unwrap().as_ref());
    if is_smb {
        match fs::remove_file(file_path) {
            Ok(_) => Ok(()),
            Err(err) => {
                println!("删除失败: {:?}", err);
                Err(err.to_string())
            }
        }
    } else {
        match trash::delete(file_path) {
            Ok(_) => Ok(()),
            Err(err) => {
                println!("删除失败: {:?}", err);
                Err(err.to_string())
            }
        }
    }
}

use std::process::Command;
use std::{fs, str};

#[allow(unused)]
#[derive(Debug)]
struct SmbShare {
    status: String,
    local: String,
    remote: String,
    network: String,
}

fn parse_smb_shares(output: &str) -> Vec<SmbShare> {
    let mut shares = Vec::new();

    for line in output.lines().skip(3) {
        // 跳过前3行标题
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 4 {
            shares.push(SmbShare {
                status: parts[0].to_string(),
                local: parts[1].to_string(),
                remote: parts[2..parts.len() - 1].join(" "), // 处理可能的空格
                network: parts[parts.len() - 1].to_string(),
            });
        }
    }

    shares
}

fn is_smb_mounted(drive_letter: &OsStr) -> bool {
    // 执行 `net use` 命令
    let output = Command::new("net")
        .arg("use")
        .output()
        .expect("Failed to execute command");

    // 将输出转换为字符串
    let output_str = str::from_utf8(&output.stdout).expect("Invalid UTF-8 output");
    let smb_shares = parse_smb_shares(output_str);

    // 检查输出中是否包含指定的盘符
    smb_shares
        .iter()
        .any(|share| OsStr::new(&share.local) == drive_letter)
}
