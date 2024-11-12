use std::{error::Error, ffi::OsString, fmt::Display, io};

use serde::Serialize;
use specta::Type;
use tauri_plugin_http::reqwest;
use thiserror::Error;

#[derive(Error, Debug, Serialize, Type)]
pub enum SevenzError {
    #[error("7-Zip 未安装")]
    NotFound7z,
    #[error("需要密码输入: {0:?}")]
    NeedPassword(OsString),
    #[error("执行 7z 命令时出错: {0}")]
    CommandError(String),
    #[error("执行 7z 命令时出错: {0:?}")]
    CommandIoError(#[from] IoError),
    #[error("reqwest error: {0}")]
    #[specta(skip)]
    ReqwestError(#[from] ReqwestError),
    #[error("无效的 UTF-8 字符串: {0}")]
    InvalidUtf8(String),
}

#[derive(Debug)]
pub struct ReqwestError(reqwest::Error);

impl Error for ReqwestError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        self.0.source()
    }
}

impl Display for ReqwestError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}

impl From<reqwest::Error> for ReqwestError {
    fn from(e: reqwest::Error) -> Self {
        ReqwestError(e)
    }
}

impl From<reqwest::Error> for SevenzError {
    fn from(e: reqwest::Error) -> Self {
        SevenzError::ReqwestError(e.into())
    }
}

impl serde::Serialize for ReqwestError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.0.to_string())
    }
}

#[derive(Debug, Type)]
pub struct IoError(#[specta(type= String)] pub io::Error);

impl Error for IoError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        self.0.source()
    }
}

impl Display for IoError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}

impl From<io::Error> for IoError {
    fn from(e: io::Error) -> Self {
        IoError(e)
    }
}

impl From<io::Error> for SevenzError {
    fn from(e: io::Error) -> Self {
        SevenzError::CommandIoError(e.into())
    }
}

impl serde::Serialize for IoError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.0.to_string())
    }
}
