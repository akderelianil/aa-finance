//! Reading and writing amounts: the canonical form and both separator styles, every scale, the stored bounds, and refused text (ADR-0010).

use super::*;
use proptest::prelude::*;

fn rule(result: Result<i64>) -> Option<RuleCode> {
    match result {
        Err(Error::Rule(code)) => Some(code),
        _ => None,
    }
}

#[test]
fn the_rule_helper_reports_only_rule_errors() {
    assert_eq!(rule(Ok(1)), None);
    assert_eq!(rule(Err(Error::Internal("x"))), None);
}

#[test]
fn parses_the_canonical_form_at_every_scale() {
    // Arrange / Act / Assert
    assert_eq!(
        parse_amount("12.34", 2, Separators::CANONICAL).unwrap(),
        1234
    );
    assert_eq!(parse_amount("-0.05", 2, Separators::CANONICAL).unwrap(), -5);
    assert_eq!(parse_amount("+7", 2, Separators::CANONICAL).unwrap(), 700);
    assert_eq!(
        parse_amount("1234", 0, Separators::CANONICAL).unwrap(),
        1234
    );
    assert_eq!(
        parse_amount("0.000000000000000001", 18, Separators::CANONICAL).unwrap(),
        1
    );
    assert_eq!(
        parse_amount("  3.5 ", 1, Separators::CANONICAL).unwrap(),
        35
    );
}

#[test]
fn parses_both_separator_styles() {
    assert_eq!(
        parse_amount("1,234.56", 2, Separators::DOT_DECIMAL).unwrap(),
        123_456
    );
    assert_eq!(
        parse_amount("1.234,56", 2, Separators::COMMA_DECIMAL).unwrap(),
        123_456
    );
    assert_eq!(
        parse_amount("1.234.567", 0, Separators::COMMA_DECIMAL).unwrap(),
        1_234_567
    );
    assert_eq!(
        parse_amount("1234,5", 2, Separators::COMMA_DECIMAL).unwrap(),
        123_450
    );
    assert_eq!(
        parse_amount("-12,5", 2, Separators::COMMA_DECIMAL).unwrap(),
        -1250
    );
}

const STYLES: [Separators; 3] = [
    Separators::CANONICAL,
    Separators::DOT_DECIMAL,
    Separators::COMMA_DECIMAL,
];

#[test]
fn refuses_text_that_is_not_an_amount_in_every_style_and_scale() {
    let bad = [
        "",
        " ",
        "-",
        "+",
        "--1",
        "+-1",
        ".5",
        "-.5",
        "+.5",
        ".",
        ".0",
        ".00",
        "5.",
        "abc",
        "1e3",
        "1 000",
        "\u{a0}5",
        "5\u{a0}",
        "٣",
        "１２",
        "1\u{2212}2",
    ];
    for style in STYLES {
        for scale in [0u8, 2] {
            for text in bad {
                assert_eq!(
                    rule(parse_amount(text, scale, style)),
                    Some(RuleCode::AmountInvalid),
                    "{text:?} {style:?} {scale}"
                );
            }
        }
    }
}

#[test]
fn refuses_misplaced_group_marks() {
    for bad in [
        "1,23.4", "1.2.3", "1,2345.0", ",234", "1,", "1,234,", "1234,567", "1.2,34", "1,,234",
    ] {
        assert_eq!(
            rule(parse_amount(bad, 2, Separators::DOT_DECIMAL)),
            Some(RuleCode::AmountInvalid),
            "{bad:?}"
        );
    }
    // The canonical form has no grouping mark, and the other style's marks are not accepted.
    assert_eq!(
        rule(parse_amount("1,234", 0, Separators::CANONICAL)),
        Some(RuleCode::AmountInvalid)
    );
    assert_eq!(
        rule(parse_amount("1,5", 1, Separators::DOT_DECIMAL)),
        Some(RuleCode::AmountInvalid)
    );
    assert_eq!(
        rule(parse_amount("1.5", 1, Separators::COMMA_DECIMAL)),
        Some(RuleCode::AmountInvalid)
    );
}

#[test]
fn group_marks_and_zero_forms_read_as_expected() {
    assert_eq!(
        parse_amount("0,000", 0, Separators::DOT_DECIMAL).unwrap(),
        0
    );
    assert_eq!(parse_amount("-0", 2, Separators::CANONICAL).unwrap(), 0);
    assert_eq!(parse_amount("-0.00", 2, Separators::CANONICAL).unwrap(), 0);
    assert_eq!(format_amount(0, 2, Separators::CANONICAL), "0.00");
    // The same text means a group in one style and a decimal in the other: the typed form is
    // ambiguous, which is why the UI shows the parsed value back.
    assert_eq!(
        parse_amount("1.234", 3, Separators::DOT_DECIMAL).unwrap(),
        1234
    );
    assert_eq!(
        parse_amount("1.234", 0, Separators::COMMA_DECIMAL).unwrap(),
        1234
    );
    assert_eq!(
        rule(parse_amount("1.234,5", 0, Separators::COMMA_DECIMAL)),
        Some(RuleCode::AmountTooPrecise)
    );
    assert_eq!(
        parse_amount("1.234,0", 0, Separators::COMMA_DECIMAL).unwrap(),
        1234
    );
}

#[test]
fn refuses_digits_that_the_scale_cannot_hold_but_accepts_trailing_zeros() {
    assert_eq!(
        rule(parse_amount("1.234", 2, Separators::CANONICAL)),
        Some(RuleCode::AmountTooPrecise)
    );
    assert_eq!(
        rule(parse_amount("0.5", 0, Separators::CANONICAL)),
        Some(RuleCode::AmountTooPrecise)
    );
    assert_eq!(
        parse_amount("1.230", 2, Separators::CANONICAL).unwrap(),
        123
    );
    assert_eq!(parse_amount("1.00", 0, Separators::CANONICAL).unwrap(), 1);
}

#[test]
fn stored_bounds_are_exact() {
    assert_eq!(
        parse_amount("4611686018427387904", 0, Separators::CANONICAL).unwrap(),
        MAX_STORED
    );
    assert_eq!(
        parse_amount("-4611686018427387904", 0, Separators::CANONICAL).unwrap(),
        -MAX_STORED
    );
    assert_eq!(
        parse_amount("4.611686018427387904", 18, Separators::CANONICAL).unwrap(),
        MAX_STORED
    );
    for over in [
        "4611686018427387905",
        "-9223372036854775808",
        "9223372036854775808",
        "99999999999999999999999999999999999999999",
        "-4611686018427387905",
    ] {
        assert_eq!(
            rule(parse_amount(over, 0, Separators::CANONICAL)),
            Some(RuleCode::AmountOutOfRange),
            "{over}"
        );
    }
}

#[test]
fn the_stored_bounds_are_exact_at_every_scale() {
    for scale in 0..=MAX_SCALE {
        let top = format_amount(MAX_STORED, scale, Separators::CANONICAL);
        assert_eq!(
            parse_amount(&top, scale, Separators::CANONICAL).unwrap(),
            MAX_STORED,
            "{top}"
        );
        let bottom = format_amount(-MAX_STORED, scale, Separators::CANONICAL);
        assert_eq!(
            parse_amount(&bottom, scale, Separators::CANONICAL).unwrap(),
            -MAX_STORED
        );
        let over = format_amount(MAX_STORED + 1, scale, Separators::CANONICAL);
        assert_eq!(
            rule(parse_amount(&over, scale, Separators::CANONICAL)),
            Some(RuleCode::AmountOutOfRange),
            "{over}"
        );
    }
}

#[test]
fn refuses_a_scale_the_schema_would_refuse() {
    assert_eq!(
        rule(parse_amount("1", 19, Separators::CANONICAL)),
        Some(RuleCode::CommodityScaleInvalid)
    );
}

#[test]
fn formats_with_exactly_the_scale_in_every_style() {
    assert_eq!(format_amount(123_456, 2, Separators::CANONICAL), "1234.56");
    assert_eq!(
        format_amount(123_456, 2, Separators::DOT_DECIMAL),
        "1,234.56"
    );
    assert_eq!(
        format_amount(123_456, 2, Separators::COMMA_DECIMAL),
        "1.234,56"
    );
    assert_eq!(format_amount(-5, 2, Separators::CANONICAL), "-0.05");
    assert_eq!(format_amount(0, 2, Separators::CANONICAL), "0.00");
    assert_eq!(
        format_amount(1_234_567, 0, Separators::DOT_DECIMAL),
        "1,234,567"
    );
    assert_eq!(
        format_amount(1, 18, Separators::CANONICAL),
        "0.000000000000000001"
    );
    assert_eq!(
        format_amount(-MAX_STORED, 18, Separators::CANONICAL),
        "-4.611686018427387904"
    );
    assert_eq!(format_amount(100, 2, Separators::COMMA_DECIMAL), "1,00");
}

proptest! {
    #[test]
    fn format_then_parse_returns_the_same_value(
        value in -MAX_STORED..=MAX_STORED,
        scale in 0u8..=18,
        style in 0usize..3,
    ) {
        let separators = [Separators::CANONICAL, Separators::DOT_DECIMAL, Separators::COMMA_DECIMAL][style];
        let text = format_amount(value, scale, separators);
        prop_assert_eq!(parse_amount(&text, scale, separators).unwrap(), value);
    }

    #[test]
    fn parsing_text_built_from_the_tricky_characters_never_panics_and_reparses(
        text in "[-+ 0-9.,\u{a0}\u{661}é]{0,30}",
        scale in 0u8..=20,
        style in 0usize..3,
    ) {
        let separators = STYLES[style];
        if let Ok(value) = parse_amount(&text, scale, separators) {
            prop_assert_eq!(parse_amount(&format_amount(value, scale, separators), scale, separators).unwrap(), value);
        }
    }

    #[test]
    fn canonical_text_parses_to_the_exact_scaled_integer(
        whole in 0u64..1_000_000_000,
        fraction in 0u64..1_000_000_000,
        scale in 0u8..=9,
        negative in proptest::bool::ANY,
    ) {
        let fraction = fraction % 10u64.pow(u32::from(scale));
        let unsigned = if scale == 0 {
            whole.to_string()
        } else {
            format!("{whole}.{fraction:0width$}", width = usize::from(scale))
        };
        let magnitude = i64::try_from(whole * 10u64.pow(u32::from(scale)) + fraction).unwrap();
        let expected = if negative { -magnitude } else { magnitude };
        let text = if negative { format!("-{unsigned}") } else { unsigned.clone() };
        prop_assert_eq!(parse_amount(&text, scale, Separators::CANONICAL).unwrap(), expected);
        // Formatting writes a sign only for a nonzero negative value ("-0.00" reads back as 0).
        let formatted = format_amount(expected, scale, Separators::CANONICAL);
        prop_assert_eq!(formatted, if expected < 0 { format!("-{unsigned}") } else { unsigned });
    }

    #[test]
    fn formatting_never_panics_for_any_value(value in proptest::num::i64::ANY, scale in 0u8..=18, style in 0usize..3) {
        let _ = format_amount(value, scale, STYLES[style]);
    }
}
