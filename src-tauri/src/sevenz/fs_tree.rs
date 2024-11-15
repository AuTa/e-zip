use std::{
    fmt,
    ops::{Deref, DerefMut},
    path::PathBuf,
};

use ego_tree::Tree;
use serde::Serialize;
use specta::{datatype::DataType, NamedType, Type};

use crate::sevenz::archives_have_root_folder;

#[derive(Debug, Serialize, Clone, Type, Default)]
pub struct Fs {
    name: String,
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

#[derive(Debug, Serialize, Clone, Type)]
pub struct FsTreeNode(FsNode);

impl Deref for FsTreeNode {
    type Target = FsNode;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl fmt::Display for FsTreeNode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

#[derive(Debug, Serialize)]
pub struct FsTree(Tree<FsNode>);

#[derive(Debug, Serialize)]
pub struct ArchiveTree {
    path: PathBuf,
    tree: FsTree,
}

impl FsTree {
    fn append_path(&mut self, path: String, is_dir: bool) {
        let tree = &mut *self;
        let mut sub_paths = path.split('\\').filter(|s| !s.is_empty()).peekable(); // NOTE: peekable
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
            };
            parent = part;
            let new_node = if sub_paths.peek().is_none() && !is_dir {
                FsNode::File(fs)
            } else {
                FsNode::Dir(fs)
            };
            let mut node = root.tree().get_mut(node_id).unwrap();
            node_id = node.append(new_node).id();
        }
    }
}

impl ArchiveTree {
    pub fn new(path: PathBuf) -> Self {
        ArchiveTree {
            path,
            tree: FsTree(Tree::new(FsNode::None)),
        }
    }

    pub fn append_path(&mut self, path: String, is_dir: bool) {
        self.tree.append_path(path, is_dir);
    }

    pub fn set_has_root_folder(&self) -> bool {
        let mut has_root_folder = true;
        if self.tree.root().children().count() == 1 {
            has_root_folder = false;
        }
        let mut map = archives_have_root_folder();
        map.insert(self.path.clone(), has_root_folder);
        has_root_folder
    }

    pub fn has_root_folder(&self, path: PathBuf) -> bool {
        let map = archives_have_root_folder();
        *map.get(&path).unwrap_or(&true)
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

impl fmt::Display for ArchiveTree {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        writeln!(f, "{}\n{}", self.path.display(), self.tree)
    }
}

// https://github.com/specta-rs/specta/issues/285 Recursive structs cause a stack overflow
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
        SpectaNode::<FsTreeNode>::inline(type_map, generics)
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
        SpectaNode::<FsTreeNode>::sid()
    }

    fn named_data_type(
        type_map: &mut specta::TypeMap,
        generics: &[DataType],
    ) -> specta::datatype::NamedDataType {
        SpectaNode::<FsTreeNode>::named_data_type(type_map, generics)
    }

    fn definition_named_data_type(
        type_map: &mut specta::TypeMap,
    ) -> specta::datatype::NamedDataType {
        SpectaNode::<FsTreeNode>::definition_named_data_type(type_map)
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
        tree.append_path("a\\b\\c".to_string(), true);
        tree.append_path("a\\b\\d".to_string(), false);
        tree.append_path("a\\e\\f".to_string(), true);
        assert_eq!(
            format!("{}", tree),
            "a\n├── b\n│   ├── c\n│   └── d\n└── e\n    └── f\n"
        );
    }
}
