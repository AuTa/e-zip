use std::fs;
use std::path::PathBuf;

use trash;

pub fn delete_archive(file_path: &PathBuf) -> Result<(), String> {
    match trash::delete(file_path) {
        Ok(_) => Ok(()),
        Err(err) => {
            println!("删除到回收站失败: {:?}", err);
            match fs::remove_file(file_path) {
                Ok(_) => Ok(()),
                Err(err) => {
                    println!("删除失败: {:?}", err);
                    Err(err.to_string())
                }
            }
        }
    }
}
