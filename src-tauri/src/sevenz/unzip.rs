use std::{path::PathBuf, process::Command};

use crate::sevenz::archives_have_root_folder;

pub fn unzip(path: PathBuf, target_dir: PathBuf) -> bool {
    let mut map = archives_have_root_folder();
    map.insert(path.clone(), true);
    true
}
const EXTRACT_COMMAND_ARGS: [&str; 5] = ["x", "-aou", "-o","-bsp1", "-sccUTF-8"];

fn sevenz_extract(path: PathBuf, target_dir: PathBuf) -> bool {
    // TODO: Add password support.
    let mut command = Command::new("7z.exe");
    command.arg
    true
}
