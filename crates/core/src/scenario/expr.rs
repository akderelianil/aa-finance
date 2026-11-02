//! The expression language of scenarios (ADR-0024): amounts and booleans, `+`, `-`, comparisons,
//! `and`, `or`, `not`, `sum(list.field)` and the literal `0`. No float, no loops, no conditionals.
//! An expression is checked when its pack loads (names, types, length, depth) and evaluated with
//! checked integer arithmetic over amounts of one commodity.

use crate::ids::DocId;
use std::collections::{HashMap, HashSet};

/// The longest expression a pack may hold, in bytes.
pub const MAX_LENGTH: usize = 256;
/// The deepest nesting an expression may have.
pub const MAX_DEPTH: usize = 16;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Type {
    Amount,
    Bool,
}

/// An amount in the scale of its commodity. `commodity` is `None` only for a zero that has none
/// (the literal `0`, the sum of an empty list); such a zero combines with any commodity. The fields
/// are crate-private: outside the core a quantity comes from `Quantity::of` or `Quantity::ZERO`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Quantity {
    pub(crate) value: i64,
    pub(crate) commodity: Option<DocId>,
}

impl Quantity {
    pub const ZERO: Quantity = Quantity {
        value: 0,
        commodity: None,
    };

    pub fn of(value: i64, commodity: DocId) -> Quantity {
        Quantity {
            value,
            commodity: Some(commodity),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Value {
    Amount(Quantity),
    Bool(bool),
}

/// The names an expression may use: plain values with their type, and amount fields of lists.
#[derive(Debug, Clone, Default)]
pub struct Names {
    scalars: HashMap<String, Type>,
    list_fields: HashSet<(String, String)>,
}

impl Names {
    pub fn scalar(mut self, name: &str, ty: Type) -> Names {
        self.scalars.insert(name.to_owned(), ty);
        self
    }

    pub fn list_field(mut self, list: &str, field: &str) -> Names {
        self.list_fields.insert((list.to_owned(), field.to_owned()));
        self
    }
}

/// Where evaluation reads the values of names.
pub trait Env {
    fn amount(&self, name: &str) -> Option<Quantity>;
    fn flag(&self, name: &str) -> Option<bool>;
    fn list(&self, list: &str, field: &str) -> Option<Vec<Quantity>>;
}

/// Why a pack's expression does not load. `at` is a byte offset into the text.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum CompileError {
    #[error("the expression is longer than {MAX_LENGTH} bytes")]
    TooLong,
    #[error("the expression nests deeper than {MAX_DEPTH}")]
    TooDeep,
    #[error("syntax error at byte {at}")]
    Syntax { at: usize },
    #[error("unknown name: {0}")]
    UnknownName(String),
    #[error("unknown list field: {list}.{field}")]
    UnknownField { list: String, field: String },
    #[error("wrong type at byte {at}")]
    Type { at: usize },
}

/// Why an expression that loaded could not give a value.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum EvalError {
    #[error("no value for {0}")]
    Missing(String),
    #[error("amounts in two different commodities")]
    CommodityMismatch,
    #[error("the result does not fit in an amount")]
    Overflow,
}

/// A checked tree that gives an amount. Amount and boolean nodes are separate types, so a node of
/// the wrong type cannot be built and evaluation has no impossible branch.
#[derive(Debug, Clone)]
enum AmountNode {
    Zero,
    Name(String),
    Sum(String, String),
    Neg(Box<AmountNode>),
    Add(Box<AmountNode>, Box<AmountNode>),
    Sub(Box<AmountNode>, Box<AmountNode>),
}

/// A checked tree that gives a boolean.
#[derive(Debug, Clone)]
enum BoolNode {
    Name(String),
    Not(Box<BoolNode>),
    Cmp(CmpOp, Box<AmountNode>, Box<AmountNode>),
    And(Box<BoolNode>, Box<BoolNode>),
    Or(Box<BoolNode>, Box<BoolNode>),
}

#[derive(Debug, Clone)]
enum Node {
    Amount(AmountNode),
    Bool(BoolNode),
}

/// An expression that passed the loader's checks.
#[derive(Debug, Clone)]
pub struct Expr {
    root: Node,
}

impl Expr {
    pub fn ty(&self) -> Type {
        match self.root {
            Node::Amount(_) => Type::Amount,
            Node::Bool(_) => Type::Bool,
        }
    }

    pub fn eval(&self, env: &dyn Env) -> Result<Value, EvalError> {
        match &self.root {
            Node::Amount(node) => amount(node, env).map(Value::Amount),
            Node::Bool(node) => flag(node, env).map(Value::Bool),
        }
    }
}

/// Load an expression against the names a scenario defines.
pub fn compile(text: &str, names: &Names) -> Result<Expr, CompileError> {
    if text.len() > MAX_LENGTH {
        return Err(CompileError::TooLong);
    }
    let root = check(parse::parse(text)?, names)?;
    Ok(Expr { root })
}

fn amount_of(node: Syntax, names: &Names) -> Result<AmountNode, CompileError> {
    let at = node.at;
    match check(node, names)? {
        Node::Amount(n) => Ok(n),
        Node::Bool(_) => Err(CompileError::Type { at }),
    }
}

fn bool_of(node: Syntax, names: &Names) -> Result<BoolNode, CompileError> {
    let at = node.at;
    match check(node, names)? {
        Node::Bool(n) => Ok(n),
        Node::Amount(_) => Err(CompileError::Type { at }),
    }
}

fn check(node: Syntax, names: &Names) -> Result<Node, CompileError> {
    let amounts = |l: Box<Syntax>, r: Box<Syntax>| -> Result<_, CompileError> {
        Ok((
            Box::new(amount_of(*l, names)?),
            Box::new(amount_of(*r, names)?),
        ))
    };
    let bools = |l: Box<Syntax>, r: Box<Syntax>| -> Result<_, CompileError> {
        Ok((Box::new(bool_of(*l, names)?), Box::new(bool_of(*r, names)?)))
    };
    Ok(match node.kind {
        SyntaxKind::Zero => Node::Amount(AmountNode::Zero),
        SyntaxKind::Name(name) => match names.scalars.get(&name) {
            Some(Type::Amount) => Node::Amount(AmountNode::Name(name)),
            Some(Type::Bool) => Node::Bool(BoolNode::Name(name)),
            None => return Err(CompileError::UnknownName(name)),
        },
        SyntaxKind::Sum(list, field) => {
            if !names.list_fields.contains(&(list.clone(), field.clone())) {
                return Err(CompileError::UnknownField { list, field });
            }
            Node::Amount(AmountNode::Sum(list, field))
        }
        SyntaxKind::Neg(inner) => {
            Node::Amount(AmountNode::Neg(Box::new(amount_of(*inner, names)?)))
        }
        SyntaxKind::Not(inner) => Node::Bool(BoolNode::Not(Box::new(bool_of(*inner, names)?))),
        SyntaxKind::Add(l, r) => {
            let (l, r) = amounts(l, r)?;
            Node::Amount(AmountNode::Add(l, r))
        }
        SyntaxKind::Sub(l, r) => {
            let (l, r) = amounts(l, r)?;
            Node::Amount(AmountNode::Sub(l, r))
        }
        SyntaxKind::Cmp(op, l, r) => {
            let (l, r) = amounts(l, r)?;
            Node::Bool(BoolNode::Cmp(op, l, r))
        }
        SyntaxKind::And(l, r) => {
            let (l, r) = bools(l, r)?;
            Node::Bool(BoolNode::And(l, r))
        }
        SyntaxKind::Or(l, r) => {
            let (l, r) = bools(l, r)?;
            Node::Bool(BoolNode::Or(l, r))
        }
    })
}

/// The commodity two amounts share; a zero without one takes the other's.
fn shared(a: Quantity, b: Quantity) -> Result<Option<DocId>, EvalError> {
    match (a.commodity, b.commodity) {
        (Some(x), Some(y)) if x != y => Err(EvalError::CommodityMismatch),
        (x, y) => Ok(x.or(y)),
    }
}

fn combine(
    a: Quantity,
    b: Quantity,
    op: fn(i64, i64) -> Option<i64>,
) -> Result<Quantity, EvalError> {
    let commodity = shared(a, b)?;
    let value = op(a.value, b.value).ok_or(EvalError::Overflow)?;
    Ok(Quantity { value, commodity })
}

fn amount(node: &AmountNode, env: &dyn Env) -> Result<Quantity, EvalError> {
    match node {
        AmountNode::Zero => Ok(Quantity::ZERO),
        AmountNode::Name(name) => env
            .amount(name)
            .ok_or_else(|| EvalError::Missing(name.clone())),
        AmountNode::Sum(list, field) => env
            .list(list, field)
            .ok_or_else(|| EvalError::Missing(format!("{list}.{field}")))?
            .into_iter()
            .try_fold(Quantity::ZERO, |acc, q| combine(acc, q, i64::checked_add)),
        AmountNode::Neg(inner) => combine(Quantity::ZERO, amount(inner, env)?, i64::checked_sub),
        AmountNode::Add(l, r) => combine(amount(l, env)?, amount(r, env)?, i64::checked_add),
        AmountNode::Sub(l, r) => combine(amount(l, env)?, amount(r, env)?, i64::checked_sub),
    }
}

fn flag(node: &BoolNode, env: &dyn Env) -> Result<bool, EvalError> {
    match node {
        BoolNode::Name(name) => env
            .flag(name)
            .ok_or_else(|| EvalError::Missing(name.clone())),
        BoolNode::Not(inner) => Ok(!flag(inner, env)?),
        // Both sides always run, so a missing value is never hidden by the other side.
        BoolNode::And(l, r) => {
            let (l, r) = (flag(l, env)?, flag(r, env)?);
            Ok(l && r)
        }
        BoolNode::Or(l, r) => {
            let (l, r) = (flag(l, env)?, flag(r, env)?);
            Ok(l || r)
        }
        BoolNode::Cmp(op, l, r) => {
            let (l, r) = (amount(l, env)?, amount(r, env)?);
            shared(l, r)?;
            Ok(match op {
                CmpOp::Eq => l.value == r.value,
                CmpOp::Ne => l.value != r.value,
                CmpOp::Lt => l.value < r.value,
                CmpOp::Le => l.value <= r.value,
                CmpOp::Gt => l.value > r.value,
                CmpOp::Ge => l.value >= r.value,
            })
        }
    }
}

mod parse;
use parse::{CmpOp, Syntax, SyntaxKind};

#[cfg(test)]
mod tests;
