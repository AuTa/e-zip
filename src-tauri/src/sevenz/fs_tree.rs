use std::{
    fmt,
    ops::{Deref, DerefMut},
    path::PathBuf,
};

use ego_tree::{NodeId, Tree};
use regex::Regex;
use serde::Serialize;
use specta::{datatype::DataType, NamedType, Type};
use specta_util::Unknown;
use time::OffsetDateTime;

use crate::sevenz::archives_have_root_dir;

use super::{multi_volume::ArchiveMultiVolume, OptionalCodepage, OutputFile};

#[derive(Debug, Serialize, Clone, Type, Default)]
pub struct Fs {
    name: String,
    modified: Option<OffsetDateTime>,
    parent: Option<String>,
}

impl fmt::Display for Fs {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.name)
    }
}

#[derive(Debug, Serialize, Clone, Type, Default)]
#[serde(tag = "type")]
pub enum FsNode {
    #[default]
    None,
    Dir(Fs),
    File(Fs),
}

impl FsNode {
    pub fn name(&self) -> String {
        match self {
            Self::Dir(fs) | Self::File(fs) => fs.name.clone(),
            _ => "\\".to_string(),
        }
    }

    #[allow(unused)]
    pub const fn is_none(&self) -> bool {
        matches!(self, Self::None)
    }

    pub const fn is_dir(&self) -> bool {
        matches!(self, Self::Dir(_))
    }

    pub const fn is_file(&self) -> bool {
        matches!(self, Self::File(_))
    }
}

impl fmt::Display for FsNode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let flag = if self.is_dir() {
            "📁 "
        } else if self.is_file() {
            "📄 "
        } else {
            ""
        };
        write!(f, "{flag}{}", self.name())
    }
}

#[derive(Debug, Serialize)]
pub struct FsTree(Tree<FsNode>);

impl FsTree {
    fn append_file(&mut self, file: OutputFile) {
        let tree = &mut *self;
        let re = Regex::new(r"[\\/]").unwrap();
        let mut sub_paths = re.split(&file.path).filter(|s| !s.is_empty()).peekable(); // NOTE: peekable
        let mut parent = "";
        let mut root = tree.root_mut();
        let mut node_id = root.id();

        'path: while let Some(part) = sub_paths.next() {
            // check if the part node already exists.
            let node_ref = root.tree().get(node_id).unwrap();
            for child in node_ref.children() {
                if child.value().name() == part {
                    node_id = child.id();
                    parent = part;
                    continue 'path;
                }
            }
            // create a new child node.
            let fs = Fs {
                name: part.to_string(),
                parent: Some(parent.to_string()),
                modified: file.modified,
            };
            parent = part;
            let new_node = if sub_paths.peek().is_none() && !file.is_dir {
                FsNode::File(fs)
            } else {
                FsNode::Dir(fs)
            };
            let mut node = root.tree().get_mut(node_id).unwrap();
            node_id = node.append(new_node).id();
        }
    }

    fn sort(&mut self) {
        let children = self.root().children().map(|n| n.id()).collect::<Vec<_>>();

        sort_recursion(children, self);
    }

    fn only_one_root_dir(&self) -> bool {
        let count = self.root().children().count();
        match count {
            0 => true,
            1 => self.root().first_child().unwrap().value().is_dir(),
            _ => false,
        }
    }
}

fn sort_recursion(children: Vec<NodeId>, tree: &mut Tree<FsNode>) {
    for child in children {
        {
            let mut child_mut = tree.get_mut(child).unwrap();
            child_mut.sort_by_key(|a| a.value().name());
        }
        let child_children = tree
            .get(child)
            .unwrap()
            .children()
            .map(|n| n.id())
            .collect::<Vec<_>>();
        sort_recursion(child_children, tree);
    }
}

#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveContents {
    path: PathBuf,
    #[specta(type = Unknown)]
    contents: FsTree,
    password: Option<String>,
    codepage: OptionalCodepage,
    multi_volume: Option<ArchiveMultiVolume>,
    has_root_dir: bool,
}

impl ArchiveContents {
    pub fn new(path: PathBuf) -> Self {
        ArchiveContents {
            path,
            contents: FsTree(Tree::new(FsNode::None)),
            password: None,
            codepage: None,
            multi_volume: None,
            has_root_dir: false,
        }
    }

    pub fn append_file(&mut self, file: OutputFile) {
        self.contents.append_file(file);
    }

    pub fn set_has_root_dir(&mut self) -> bool {
        self.has_root_dir = self.contents.only_one_root_dir();
        let mut map = archives_have_root_dir();
        map.insert(self.path.clone(), self.has_root_dir);
        self.has_root_dir
    }

    pub fn set_password<S: Into<String>>(&mut self, password: S) {
        let password = password.into();
        if password.is_empty() {
            self.password = None;
        } else {
            self.password = Some(password);
        }
    }

    pub fn set_codepage(&mut self, codepage: OptionalCodepage) {
        self.codepage = codepage;
    }

    pub fn sort(&mut self) {
        self.contents.sort();
    }

    /// Whether the archive is a multi-volume archive.
    ///
    /// Returns `true` if the archive is a multi-volume archive, or `false` otherwise.
    pub fn is_multi_volume(&self) -> bool {
        self.multi_volume.is_some()
    }

    pub fn set_multi_volume(&mut self, multi_volume: ArchiveMultiVolume) {
        self.multi_volume = Some(multi_volume);
    }

    /// If the archive is a multi-volume archive, set the actual path of the first volume of the archive.
    pub fn set_actual_path(&mut self, actual_path: PathBuf) {
        if let Some(multi_volume) = &mut self.multi_volume {
            multi_volume.set_actual_path(actual_path);
        }
    }
}

impl Deref for FsTree {
    type Target = Tree<FsNode>;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl DerefMut for FsTree {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

mod display;

impl fmt::Display for FsTree {
    // Doesn't display the root node.
    // Code copy from https://github.com/egoist/ego-tree
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        use crate::sevenz::fs_tree::display::Indentation;
        use ego_tree::iter::Edge;

        let mut indent: Indentation = Indentation::new(true);

        let root = self.root().children().flat_map(|node| node.traverse());
        for edge in root {
            match edge {
                Edge::Open(node) if node.has_children() => {
                    indent.indent(node.next_sibling().is_some());
                    writeln!(f, "{indent}{}", node.value())?;
                }
                Edge::Open(node) => {
                    indent.indent(node.next_sibling().is_some());
                    writeln!(f, "{indent}{}", node.value())?;
                    indent.deindent();
                }
                Edge::Close(node) if node.has_children() => {
                    indent.deindent();
                }
                _ => {}
            }
        }
        Ok(())
    }
}

impl fmt::Display for ArchiveContents {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        writeln!(f, "{}\n{}", self.path.display(), self.contents)
    }
}

// TODO: https://github.com/specta-rs/specta/issues/285 Recursive structs cause a stack overflow
#[derive(Serialize, Type)]
pub struct SpectaNode<'a, T> {
    value: &'a T,
    children: Vec<SpectaNode<'a, T>>,
}

impl Type for FsTree {
    fn inline(
        type_map: &mut specta::TypeMap,
        generics: specta::Generics,
    ) -> specta::datatype::DataType {
        SpectaNode::<FsNode>::inline(type_map, generics)
    }

    fn reference(
        type_map: &mut specta::TypeMap,
        generics: &[specta::datatype::DataType],
    ) -> specta::datatype::reference::Reference {
        specta::datatype::reference::inline::<Self>(type_map, generics)
    }
}

impl NamedType for FsTree {
    fn sid() -> specta::SpectaID {
        SpectaNode::<FsNode>::sid()
    }

    fn named_data_type(
        type_map: &mut specta::TypeMap,
        generics: &[DataType],
    ) -> specta::datatype::NamedDataType {
        SpectaNode::<FsNode>::named_data_type(type_map, generics)
    }

    fn definition_named_data_type(
        type_map: &mut specta::TypeMap,
    ) -> specta::datatype::NamedDataType {
        SpectaNode::<FsNode>::definition_named_data_type(type_map)
    }
}

#[cfg(test)]
mod test_fs_tree {
    use super::*;

    #[test]
    fn new() {
        let tree = FsTree(Tree::new(FsNode::None));
        assert_eq!(format!("{}", tree), "");
    }

    #[test]
    fn append_path() {
        let mut tree = FsTree(Tree::new(FsNode::None));
        tree.append_file(OutputFile {
            path: "a\\b\\c".to_string(),
            is_dir: true,
            modified: None,
        });
        tree.append_file(OutputFile {
            path: "a\\b\\d".to_string(),
            is_dir: false,
            modified: None,
        });
        tree.append_file(OutputFile {
            path: "a\\e\\f".to_string(),
            is_dir: true,
            modified: None,
        });
        assert_eq!(
            format!("{}", tree),
            "a\n├── b\n│   ├── c\n│   └── d\n└── e\n    └── f\n"
        );
    }
}
