pub mod tauri;

use std::{
    fs, io,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Default, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    target: Target,
    auto_delete: bool, // 自动删除已完成压缩包.
    passwords: Vec<String>,
}

impl AppConfig {
    pub fn load_from_file<P>(filename: P) -> Self
    where
        P: AsRef<Path>,
    {
        let toml_string = fs::read_to_string(filename).unwrap_or_default();
        let config: Self = toml::from_str(&toml_string).unwrap_or_default();
        config
    }

    pub fn save_to_file<P>(&self, filename: P) -> io::Result<()>
    where
        P: AsRef<Path>,
    {
        let toml_string = toml::to_string(self).unwrap_or_default();
        fs::write(filename, toml_string)?;
        Ok(())
    }

    pub fn passwords(&self) -> Vec<String> {
        self.passwords.clone()
    }
}

// 解压目标.
#[derive(Debug, Default, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Target {
    dir: PathBuf,    // 解压目标路径.
    can_input: bool, // 是否可以输入路径.
}
