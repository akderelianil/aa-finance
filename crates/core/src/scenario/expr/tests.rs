//! The scenario expression language (ADR-0024): what loads, what is refused at load, and exact,
//! checked evaluation over amounts of one commodity.

use super::*;
use proptest::prelude::*;
use std::collections::HashMap;

fn try_doc() -> DocId {
    DocId::from_uuid(uuid::Uuid::from_u128(
        0x0000_0000_0000_7000_8000_0000_0000_00a1,
    ))
}

fn usd_doc() -> DocId {
    DocId::from_uuid(uuid::Uuid::from_u128(
        0x0000_0000_0000_7000_8000_0000_0000_00a2,
    ))
}

fn names() -> Names {
    Names::default()
        .scalar("total", Type::Amount)
        .scalar("fee", Type::Amount)
        .scalar("other", Type::Amount)
        .scalar("paid", Type::Bool)
        .list_field("lines", "amount")
}

#[derive(Default)]
struct TestEnv {
    amounts: HashMap<&'static str, Quantity>,
    flags: HashMap<&'static str, bool>,
    lists: HashMap<(&'static str, &'static str), Vec<Quantity>>,
}

impl Env for TestEnv {
    fn amount(&self, name: &str) -> Option<Quantity> {
        self.amounts.get(name).copied()
    }
    fn flag(&self, name: &str) -> Option<bool> {
        self.flags.get(name).copied()
    }
    fn list(&self, list: &str, field: &str) -> Option<Vec<Quantity>> {
        self.lists
            .iter()
            .find(|((l, f), _)| *l == list && *f == field)
            .map(|(_, v)| v.clone())
    }
}

fn tl(value: i64) -> Quantity {
    Quantity::of(value, try_doc())
}

fn env(total: i64, fee: i64, other: i64) -> TestEnv {
    TestEnv {
        amounts: HashMap::from([("total", tl(total)), ("fee", tl(fee)), ("other", tl(other))]),
        flags: HashMap::from([("paid", true)]),
        lists: HashMap::from([(("lines", "amount"), vec![tl(300), tl(100), tl(100)])]),
    }
}

fn eval(text: &str, env: &TestEnv) -> Result<Value, EvalError> {
    compile(text, &names()).expect("expression loads").eval(env)
}

fn amount(text: &str, env: &TestEnv) -> i64 {
    match eval(text, env) {
        Ok(Value::Amount(q)) => q.value,
        other => panic!("{text}: expected an amount, got {other:?}"),
    }
}

fn truth(text: &str, env: &TestEnv) -> bool {
    match eval(text, env) {
        Ok(Value::Bool(b)) => b,
        other => panic!("{text}: expected a boolean, got {other:?}"),
    }
}

fn refused(text: &str) -> CompileError {
    match compile(text, &names()) {
        Err(e) => e,
        Ok(_) => panic!("{text}: expected the loader to refuse it"),
    }
}

// --- What loads and what it computes ---

#[test]
fn adds_and_subtracts_left_to_right() {
    let e = env(1000, 5, 200);
    assert_eq!(amount("total + fee", &e), 1005);
    assert_eq!(amount("total - fee - other", &e), 795);
    assert_eq!(amount("total - (fee - other)", &e), 1195);
}

#[test]
fn unary_minus_binds_tighter_than_subtraction() {
    let e = env(1000, 5, 200);
    assert_eq!(amount("-fee", &e), -5);
    assert_eq!(amount("- -fee", &e), 5);
    assert_eq!(amount("-fee - total", &e), -1005);
}

#[test]
fn sum_adds_a_field_of_every_list_item() {
    let e = env(500, 0, 0);
    assert_eq!(amount("sum(lines.amount)", &e), 500);
    assert_eq!(amount("total - sum(lines.amount)", &e), 0);
}

#[test]
fn sum_of_an_empty_list_is_a_zero_that_compares_with_any_commodity() {
    let mut e = env(500, 0, 0);
    e.lists.insert(("lines", "amount"), vec![]);
    let zero = match eval("sum(lines.amount)", &e).unwrap() {
        Value::Amount(q) => q,
        other => panic!("{other:?}"),
    };
    assert_eq!(zero, Quantity::ZERO);
    assert!(truth("total > sum(lines.amount)", &e));
}

#[test]
fn every_comparison_gives_the_expected_answer() {
    let e = env(10, 5, 10);
    assert!(truth("total = other", &e));
    assert!(!truth("total != other", &e));
    assert!(truth("fee < total", &e));
    assert!(truth("fee <= fee", &e));
    assert!(truth("total > fee", &e));
    assert!(truth("total >= other", &e));
    assert!(!truth("total < fee", &e));
}

#[test]
fn zero_is_the_only_literal_and_carries_no_commodity() {
    let e = env(10, 0, 0);
    assert!(truth("fee = 0", &e));
    assert!(truth("total > 0", &e));
    assert_eq!(amount("0 - total", &e), -10);
}

#[test]
fn not_binds_tighter_than_and_which_binds_tighter_than_or() {
    let e = env(10, 0, 0);
    // (not (fee = 0)) or ((total > 0) and paid)  ->  false or true
    assert!(truth("not fee = 0 or total > 0 and paid", &e));
    // ((not paid) or paid) and (fee > 0)  ->  false
    assert!(!truth("(not paid or paid) and fee > 0", &e));
    assert!(truth("not not paid", &e));
}

#[test]
fn the_type_of_a_loaded_expression_is_known_before_it_runs() {
    assert_eq!(compile("total + fee", &names()).unwrap().ty(), Type::Amount);
    assert_eq!(compile("total > fee", &names()).unwrap().ty(), Type::Bool);
    assert_eq!(compile("paid", &names()).unwrap().ty(), Type::Bool);
}

#[test]
fn whitespace_between_tokens_is_free() {
    let e = env(10, 5, 0);
    assert_eq!(amount("  total+fee ", &e), 15);
    assert_eq!(amount("sum( lines . amount )", &e), 500);
}

// --- What the loader refuses ---

#[test]
fn refuses_an_empty_or_blank_expression() {
    assert!(matches!(refused(""), CompileError::Syntax { .. }));
    assert!(matches!(refused("   "), CompileError::Syntax { .. }));
}

#[test]
fn refuses_any_number_other_than_zero() {
    assert!(matches!(refused("total + 1"), CompileError::Syntax { .. }));
    assert!(matches!(refused("00"), CompileError::Syntax { .. }));
    assert!(matches!(refused("0.5"), CompileError::Syntax { .. }));
}

#[test]
fn refuses_operators_the_grammar_does_not_have() {
    for text in [
        "total * fee",
        "total / fee",
        "total ? fee : other",
        "total == fee",
        "total % fee",
    ] {
        assert!(
            matches!(refused(text), CompileError::Syntax { .. }),
            "{text}"
        );
    }
}

#[test]
fn refuses_a_chained_comparison() {
    assert!(matches!(
        refused("fee < total < other"),
        CompileError::Syntax { .. }
    ));
}

#[test]
fn refuses_unbalanced_parentheses_and_trailing_text() {
    for text in [
        "(total",
        "total)",
        "total fee",
        "sum(lines.amount",
        "sum lines.amount",
    ] {
        assert!(
            matches!(refused(text), CompileError::Syntax { .. }),
            "{text}"
        );
    }
}

#[test]
fn refuses_names_outside_the_name_pattern() {
    for text in ["Total", "_total", "toplam_ğ", "1total"] {
        assert!(
            matches!(refused(text), CompileError::Syntax { .. }),
            "{text}"
        );
    }
}

#[test]
fn refuses_keywords_as_names() {
    for text in ["sum", "and", "or + 0", "not"] {
        assert!(
            matches!(refused(text), CompileError::Syntax { .. }),
            "{text}"
        );
    }
}

#[test]
fn refuses_an_unknown_name_or_list_field() {
    assert_eq!(
        refused("tax + total"),
        CompileError::UnknownName("tax".into())
    );
    assert_eq!(
        refused("sum(lines.rate)"),
        CompileError::UnknownField {
            list: "lines".into(),
            field: "rate".into()
        }
    );
    assert_eq!(
        refused("sum(rows.amount)"),
        CompileError::UnknownField {
            list: "rows".into(),
            field: "amount".into()
        }
    );
}

#[test]
fn refuses_a_list_or_a_dotted_path_used_as_a_plain_name() {
    assert!(matches!(refused("lines"), CompileError::UnknownName(_)));
    assert!(matches!(
        refused("lines.amount"),
        CompileError::Syntax { .. }
    ));
}

#[test]
fn refuses_mixing_amounts_and_booleans() {
    for text in [
        "total + paid",
        "paid > 0",
        "-paid",
        "not total",
        "total and paid",
        "paid = paid",
    ] {
        assert!(matches!(refused(text), CompileError::Type { .. }), "{text}");
    }
}

#[test]
fn refuses_text_longer_than_the_limit() {
    let long = format!("total{}", " + fee".repeat(50));
    assert!(long.len() > MAX_LENGTH);
    assert_eq!(refused(&long), CompileError::TooLong);
    let fits = format!("total{}", " + fee".repeat(41));
    assert!(fits.len() <= MAX_LENGTH);
    assert!(compile(&fits, &names()).is_ok());
}

#[test]
fn refuses_nesting_deeper_than_the_limit() {
    let deep = format!(
        "{}total{}",
        "(".repeat(MAX_DEPTH + 1),
        ")".repeat(MAX_DEPTH + 1)
    );
    assert_eq!(refused(&deep), CompileError::TooDeep);
    let minus = format!("{}fee", "-".repeat(MAX_DEPTH + 1));
    assert_eq!(refused(&minus), CompileError::TooDeep);
    let ok = format!(
        "{}total{}",
        "(".repeat(MAX_DEPTH - 1),
        ")".repeat(MAX_DEPTH - 1)
    );
    assert!(compile(&ok, &names()).is_ok());
}

#[test]
fn a_syntax_error_points_at_the_offending_character() {
    assert_eq!(refused("total * fee"), CompileError::Syntax { at: 6 });
    assert_eq!(refused("total +"), CompileError::Syntax { at: 7 });
}

// --- What evaluation refuses ---

#[test]
fn mixing_two_commodities_is_an_error_not_a_conversion() {
    let mut e = env(10, 5, 0);
    e.amounts.insert("fee", Quantity::of(5, usd_doc()));
    assert_eq!(eval("total + fee", &e), Err(EvalError::CommodityMismatch));
    assert_eq!(eval("total > fee", &e), Err(EvalError::CommodityMismatch));
    e.lists
        .insert(("lines", "amount"), vec![tl(1), Quantity::of(1, usd_doc())]);
    assert_eq!(
        eval("sum(lines.amount)", &e),
        Err(EvalError::CommodityMismatch)
    );
}

#[test]
fn overflow_is_an_error_never_a_wrap() {
    let mut e = env(i64::MAX, 1, 0);
    assert_eq!(eval("total + fee", &e), Err(EvalError::Overflow));
    e.amounts.insert("total", tl(i64::MIN));
    assert_eq!(eval("total - fee", &e), Err(EvalError::Overflow));
    assert_eq!(eval("-total", &e), Err(EvalError::Overflow));
    e.lists
        .insert(("lines", "amount"), vec![tl(i64::MAX), tl(1)]);
    assert_eq!(eval("sum(lines.amount)", &e), Err(EvalError::Overflow));
}

#[test]
fn a_value_the_environment_does_not_have_is_an_error() {
    let mut e = env(10, 5, 0);
    e.amounts.remove("fee");
    assert_eq!(
        eval("total + fee", &e),
        Err(EvalError::Missing("fee".into()))
    );
    e.flags.clear();
    assert_eq!(eval("paid", &e), Err(EvalError::Missing("paid".into())));
    e.lists.clear();
    assert_eq!(
        eval("sum(lines.amount)", &e),
        Err(EvalError::Missing("lines.amount".into()))
    );
}

#[test]
fn and_or_evaluate_both_sides_so_a_missing_value_is_never_hidden() {
    let mut e = env(10, 5, 0);
    e.amounts.remove("fee");
    assert_eq!(
        eval("total = 0 and fee > 0", &e),
        Err(EvalError::Missing("fee".into()))
    );
    assert_eq!(
        eval("total > 0 or fee > 0", &e),
        Err(EvalError::Missing("fee".into()))
    );
}

// --- Properties ---

proptest! {
    #[test]
    fn loading_arbitrary_text_never_panics(text in "\\PC{0,300}") {
        let _ = compile(&text, &names());
    }

    #[test]
    fn loading_token_soup_never_panics(parts in proptest::collection::vec(
        prop_oneof![
            Just("total"), Just("fee"), Just("paid"), Just("0"), Just("+"), Just("-"),
            Just("("), Just(")"), Just("<="), Just("="), Just("!="), Just("and"), Just("or"),
            Just("not"), Just("sum(lines.amount)"), Just(" "),
        ], 0..80)) {
        let text: String = parts.concat();
        if let Ok(expr) = compile(&text, &names()) {
            let _ = expr.eval(&env(1, 2, 3));
        }
    }

    #[test]
    fn arithmetic_matches_wide_integers_or_reports_overflow(a: i64, b: i64, c: i64) {
        let e = env(a, b, c);
        let wide = a as i128 - b as i128 + c as i128;
        let step = a as i128 - b as i128;
        let fits = |v: i128| v >= i64::MIN as i128 && v <= i64::MAX as i128;
        match eval("total - fee + other", &e) {
            Ok(Value::Amount(q)) => prop_assert_eq!(q.value as i128, wide),
            Err(EvalError::Overflow) => prop_assert!(!fits(step) || !fits(wide)),
            other => prop_assert!(false, "unexpected {:?}", other),
        }
    }
}
