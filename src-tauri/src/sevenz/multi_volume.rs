use std::{borrow::Cow, path::{Path, PathBuf}};

use regex::Regex;
use serde::Serialize;
use specta::Type;

#[derive(Default, Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveMultiVolume {
    volumes: Vec<PathBuf>,
    actual_path: PathBuf,
}

impl ArchiveMultiVolume {
    pub fn append_archive(&mut self, archive: PathBuf) {
        self.volumes.push(archive);
    }

    pub fn set_actual_path(&mut self, actual_path: PathBuf) {
        self.actual_path = actual_path;
    }
}

/// Given a path to a multi-volume archive, return the path to the first volume.
///
/// If the given path is not a multi-volume archive, return `None`.
///
/// This function is used to determine the first volume of a multi-volume
/// archive, given a path to any volume in the archive. It works by parsing
/// the file name of the given path to determine the rank of the volume, and
/// then replacing the rank with 1 to get the path to the first volume.
///
/// # Examples
///
///
pub fn get_first_volume<P: AsRef<Path>>(archive_path: P) -> Option<PathBuf> {
    let archive_path = archive_path.as_ref();
    let file_name = archive_path
        .file_name()
        .unwrap()
        .to_string_lossy()
        .to_string();
    let rank = ArchiveMultiRank::new(file_name)?;
    if rank.is_first() {
        None
    } else {
        let first_volume = rank.repalce(1);
        Some(archive_path.with_file_name(first_volume.as_ref()))
    }
}

pub fn archive_multi_volume<P: AsRef<Path>>(
    archive_path: P,
    volume_count: usize,
) -> ArchiveMultiVolume {
    let mut multi = ArchiveMultiVolume::default();
    let archive_path = archive_path.as_ref();
    let file_name = archive_path
        .file_name()
        .unwrap()
        .to_string_lossy()
        .to_string();
    let rank = ArchiveMultiRank::new(file_name);
    if let Some(rank) = rank {
        for name in rank.replace_iter(volume_count) {
            multi.append_archive(archive_path.with_file_name(name.as_ref()));
        }
    }
    multi
}

enum RankReplacer {
    RarPart,
    RNum,
    ExtNum,
}

impl RankReplacer {
    /// Replace `{}` with `rank` in a multi-volume archive suffix pattern,
    /// returning a new String.
    fn replace(&self, rank: usize) -> String {
        match self {
            RankReplacer::RarPart => format!(".part{}.rar", rank),
            RankReplacer::RNum => format!(".r{:02}", rank),
            RankReplacer::ExtNum => format!(".$ext.{:03}", rank),
        }
    }

    /// Matches multi-volume archive suffixes:
    ///
    /// - `part1.rar`
    /// - `r01`
    /// - `7z.001`
    ///
    /// The regex has three capture groups:
    ///
    /// - `rarpart`: The rank of the RAR part, without leading zeros.
    /// - `rnum`: The rank of the RAR volume, as a two-digit number.
    /// - `extnum`: The rank of the 7z or zip volume, as a three-digit number.
    fn regex() -> Regex {
        Regex::new(
            r"(\.part(?<rarpart>\d+)\.rar|\.r(?<rnum>\d+)|\.(?<ext>7z|zip)\.(?<extnum>\d+))$",
        )
        .unwrap()
    }
}

struct ArchiveMultiRank {
    rank: usize,
    replacer: RankReplacer,
    file_name: String,
    regex: Regex,
}

impl ArchiveMultiRank {
    fn new(file_name: String) -> Option<Self> {
        let regex = RankReplacer::regex();
        let captures = regex.captures(&file_name)?;
        let (rank, replacer) = if let Some(rank) = captures.name("rarpart") {
            (rank, RankReplacer::RarPart)
        } else if let Some(rank) = captures.name("rnum") {
            (rank, RankReplacer::RNum)
        } else if let Some(rank) = captures.name("extnum") {
            (rank, RankReplacer::ExtNum)
        } else {
            unreachable!()
        };
        Some(Self {
            rank: rank.as_str().parse().unwrap(),
            replacer,
            file_name,
            regex,
        })
    }

    fn is_first(&self) -> bool {
        self.rank == 1
    }

    fn repalce(&self, rank: usize) -> Cow<'_, str> {
        self.regex
            .replace(&self.file_name, self.replacer.replace(rank))
    }

    fn replace_iter(&self, volume_count: usize) -> impl Iterator<Item = Cow<'_, str>> {
        (1..=volume_count).map(move |rank| {
            self.regex
                .replace(&self.file_name, self.replacer.replace(rank))
        })
    }
}
