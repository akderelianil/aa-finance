//! Text to an untyped tree: the lexer and a recursive-descent parser for the grammar of ADR-0024.
//! Names and types are checked afterwards (`check`), so a malformed text is always a syntax error.

use super::{CompileError, MAX_DEPTH};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum CmpOp {
    Eq,
    Ne,
    Lt,
    Le,
    Gt,
    Ge,
}

/// A node of the parsed tree with the byte offset of the token that made it.
#[derive(Debug, Clone)]
pub(super) struct Syntax {
    pub at: usize,
    pub kind: SyntaxKind,
}

#[derive(Debug, Clone)]
pub(super) enum SyntaxKind {
    Zero,
    Name(String),
    Sum(String, String),
    Neg(Box<Syntax>),
    Not(Box<Syntax>),
    Add(Box<Syntax>, Box<Syntax>),
    Sub(Box<Syntax>, Box<Syntax>),
    Cmp(CmpOp, Box<Syntax>, Box<Syntax>),
    And(Box<Syntax>, Box<Syntax>),
    Or(Box<Syntax>, Box<Syntax>),
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum Tok {
    Zero,
    Name(String),
    Sum,
    And,
    Or,
    Not,
    Plus,
    Minus,
    LParen,
    RParen,
    Dot,
    Cmp(CmpOp),
    End,
}

fn lex(text: &str) -> Result<Vec<(usize, Tok)>, CompileError> {
    let bytes = text.as_bytes();
    let mut out = Vec::new();
    let mut i = 0;
    while i < bytes.len() {
        let c = bytes[i];
        let start = i;
        let tok = match c {
            b' ' | b'\t' | b'\n' | b'\r' => {
                i += 1;
                continue;
            }
            b'a'..=b'z' => {
                while i < bytes.len() && matches!(bytes[i], b'a'..=b'z' | b'0'..=b'9' | b'_') {
                    i += 1;
                }
                match &text[start..i] {
                    "sum" => Tok::Sum,
                    "and" => Tok::And,
                    "or" => Tok::Or,
                    "not" => Tok::Not,
                    word => Tok::Name(word.to_owned()),
                }
            }
            b'0' => {
                i += 1;
                if i < bytes.len() && bytes[i].is_ascii_alphanumeric() {
                    return Err(CompileError::Syntax { at: i });
                }
                Tok::Zero
            }
            b'+' | b'-' | b'(' | b')' | b'.' | b'=' => {
                i += 1;
                match c {
                    b'+' => Tok::Plus,
                    b'-' => Tok::Minus,
                    b'(' => Tok::LParen,
                    b')' => Tok::RParen,
                    b'.' => Tok::Dot,
                    _ => Tok::Cmp(CmpOp::Eq),
                }
            }
            b'!' | b'<' | b'>' => {
                let with_eq = bytes.get(i + 1) == Some(&b'=');
                i += if with_eq { 2 } else { 1 };
                match (c, with_eq) {
                    (b'!', true) => Tok::Cmp(CmpOp::Ne),
                    (b'<', false) => Tok::Cmp(CmpOp::Lt),
                    (b'<', true) => Tok::Cmp(CmpOp::Le),
                    (b'>', false) => Tok::Cmp(CmpOp::Gt),
                    (b'>', true) => Tok::Cmp(CmpOp::Ge),
                    _ => return Err(CompileError::Syntax { at: start }),
                }
            }
            _ => return Err(CompileError::Syntax { at: start }),
        };
        out.push((start, tok));
    }
    out.push((text.len(), Tok::End));
    Ok(out)
}

struct Parser {
    toks: Vec<(usize, Tok)>,
    pos: usize,
    depth: usize,
}

type Parsed = Result<Syntax, CompileError>;

/// Builds the node of a binary operator from its two operands.
type MakeBinary = fn(Box<Syntax>, Box<Syntax>) -> SyntaxKind;

impl Parser {
    fn peek(&self) -> &Tok {
        &self.toks[self.pos].1
    }

    fn at(&self) -> usize {
        self.toks[self.pos].0
    }

    fn next(&mut self) -> (usize, Tok) {
        let item = self.toks[self.pos].clone();
        if item.1 != Tok::End {
            self.pos += 1;
        }
        item
    }

    fn expect(&mut self, tok: Tok) -> Result<(), CompileError> {
        if *self.peek() == tok {
            self.next();
            Ok(())
        } else {
            Err(CompileError::Syntax { at: self.at() })
        }
    }

    fn name(&mut self) -> Result<String, CompileError> {
        match self.next() {
            (_, Tok::Name(n)) => Ok(n),
            (at, _) => Err(CompileError::Syntax { at }),
        }
    }

    /// Runs `inner` one nesting level deeper; refuses a text that nests past the limit.
    fn nested(&mut self, inner: impl FnOnce(&mut Parser) -> Parsed) -> Parsed {
        self.depth += 1;
        if self.depth > MAX_DEPTH {
            return Err(CompileError::TooDeep);
        }
        let result = inner(self);
        self.depth -= 1;
        result
    }

    fn binary(
        &mut self,
        operand: fn(&mut Parser) -> Parsed,
        op: fn(&Tok) -> Option<MakeBinary>,
    ) -> Parsed {
        let mut left = operand(self)?;
        while let Some(make) = op(self.peek()) {
            let (at, _) = self.next();
            let right = operand(self)?;
            left = Syntax {
                at,
                kind: make(Box::new(left), Box::new(right)),
            };
        }
        Ok(left)
    }

    fn or(&mut self) -> Parsed {
        self.binary(Parser::and, |t| {
            (*t == Tok::Or).then_some(SyntaxKind::Or as _)
        })
    }

    fn and(&mut self) -> Parsed {
        self.binary(Parser::not, |t| {
            (*t == Tok::And).then_some(SyntaxKind::And as _)
        })
    }

    fn not(&mut self) -> Parsed {
        if *self.peek() != Tok::Not {
            return self.compare();
        }
        let (at, _) = self.next();
        self.nested(|p| {
            Ok(Syntax {
                at,
                kind: SyntaxKind::Not(Box::new(p.not()?)),
            })
        })
    }

    fn compare(&mut self) -> Parsed {
        let left = self.sum()?;
        let Tok::Cmp(op) = *self.peek() else {
            return Ok(left);
        };
        let (at, _) = self.next();
        let right = self.sum()?;
        Ok(Syntax {
            at,
            kind: SyntaxKind::Cmp(op, Box::new(left), Box::new(right)),
        })
    }

    fn sum(&mut self) -> Parsed {
        self.binary(Parser::unary, |t| match t {
            Tok::Plus => Some(SyntaxKind::Add as _),
            Tok::Minus => Some(SyntaxKind::Sub as _),
            _ => None,
        })
    }

    fn unary(&mut self) -> Parsed {
        if *self.peek() != Tok::Minus {
            return self.atom();
        }
        let (at, _) = self.next();
        self.nested(|p| {
            Ok(Syntax {
                at,
                kind: SyntaxKind::Neg(Box::new(p.unary()?)),
            })
        })
    }

    fn atom(&mut self) -> Parsed {
        let (at, tok) = self.next();
        let kind = match tok {
            Tok::Zero => SyntaxKind::Zero,
            Tok::Name(n) => SyntaxKind::Name(n),
            Tok::Sum => {
                self.expect(Tok::LParen)?;
                let list = self.name()?;
                self.expect(Tok::Dot)?;
                let field = self.name()?;
                self.expect(Tok::RParen)?;
                SyntaxKind::Sum(list, field)
            }
            Tok::LParen => {
                let inner = self.nested(Parser::or)?;
                self.expect(Tok::RParen)?;
                return Ok(inner);
            }
            _ => return Err(CompileError::Syntax { at }),
        };
        Ok(Syntax { at, kind })
    }
}

/// Parses the whole text; anything left after the expression is a syntax error.
pub(super) fn parse(text: &str) -> Parsed {
    let mut parser = Parser {
        toks: lex(text)?,
        pos: 0,
        depth: 0,
    };
    let tree = parser.or()?;
    parser.expect(Tok::End)?;
    Ok(tree)
}
