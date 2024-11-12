use std::fmt::Display;

use serde::{Deserialize, Serialize};
use specta::Type;
use strum::{EnumDiscriminants, EnumIter, FromRepr};

// 检查字符是否为替换字符
pub fn is_replacement_character(c: char) -> bool {
    c == '�'
}

// 检查字符是否在半角片假名的 Unicode 范围内
pub fn is_halfwidth_katakana(c: char) -> bool {
    // Alternatives:
    // - `matches!(c, '\u{FF61}'..='\u{FF9F}')`
    (0xFF61..=0xFF9F).contains(&(c as u32))
}

pub fn is_latin_capital_letter(c: char)->bool {
    matches!(c, '\u{0080}'..='\u{02FF}')
}

pub type OptionalCodepage = Option<Codepage>;

// mcp=[codepage number]
#[allow(non_camel_case_types)]
#[repr(u16)]
#[derive(Debug, Serialize, Deserialize, Clone, Type, EnumDiscriminants, FromRepr, EnumIter)]
#[strum_discriminants(allow(non_camel_case_types))]
pub enum Codepage {
    SHIFT_JIS = 932,
    GB2312 = 936,
    BIG5 = 950,
    UTF_8 = 65001,
    #[serde(rename = "other")]
    Other(u16),
}

impl Codepage {
    // https://github.com/Peternator7/strum/issues/298
    fn as_u16(&self) -> u16 {
        match self {
            Codepage::Other(n) => *n,
            _ => Into::<CodepageDiscriminants>::into(self) as u16,
        }
    }
}

impl Display for Codepage {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "-mcp={}", self.as_u16())
    }
}
