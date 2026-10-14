//! Exact amounts (ADR-0010): a quantity or base value is a signed integer scaled per commodity.
//! This module reads and writes the decimal text of an amount. Amounts cross the API as strings
//! (ADR-0009), always in the canonical form (`.` decimal, no grouping); the separator styles of the
//! book country exist for what the user types and reads.

use crate::error::{Error, Result, RuleCode};

/// The largest magnitude a stored quantity or base value may have (the CHECK bound of the schema).
pub const MAX_STORED: i64 = 4_611_686_018_427_387_904;
/// The same bound as an unsigned magnitude, for comparisons with `unsigned_abs`.
pub(crate) const MAX_STORED_MAGNITUDE: u64 = MAX_STORED.unsigned_abs();
/// The largest commodity scale (the CHECK bound of the schema).
pub const MAX_SCALE: u8 = 18;

/// How a number is written: the decimal mark and, optionally, the thousands mark.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Separators {
    decimal: char,
    group: Option<char>,
}

impl Separators {
    /// The form on the API: `1234.56`.
    pub const CANONICAL: Separators = Separators {
        decimal: '.',
        group: None,
    };
    /// `1,234.56`
    pub const DOT_DECIMAL: Separators = Separators {
        decimal: '.',
        group: Some(','),
    };
    /// `1.234,56`
    pub const COMMA_DECIMAL: Separators = Separators {
        decimal: ',',
        group: Some('.'),
    };
}

/// Checks that a commodity scale is one the schema accepts.
pub fn check_scale(scale: u8) -> Result<()> {
    if scale > MAX_SCALE {
        return Err(Error::Rule(RuleCode::CommodityScaleInvalid));
    }
    Ok(())
}

const POW10: [i128; 37] = {
    let mut table = [1i128; 37];
    let mut i = 1;
    while i < 37 {
        table[i] = table[i - 1] * 10;
        i += 1;
    }
    table
};

/// 10^exp as an i128 for `exp` up to 36 (two scales of at most 18 decimals). A larger exponent is a
/// bug in the caller and stops with an index panic in every build, never a wrapped value.
pub(crate) fn pow10(exp: u32) -> i128 {
    POW10[exp as usize]
}

fn invalid() -> Error {
    Error::Rule(RuleCode::AmountInvalid)
}

/// Splits `digits` on the group mark. The first group has 1 to 3 digits, every later one exactly 3.
fn strip_groups(integer: &str, group: Option<char>) -> Result<String> {
    let Some(mark) = group else {
        return if !integer.is_empty() && integer.chars().all(|c| c.is_ascii_digit()) {
            Ok(integer.to_string())
        } else {
            Err(invalid())
        };
    };
    let parts: Vec<&str> = integer.split(mark).collect();
    let well_formed = parts.iter().enumerate().all(|(i, part)| {
        let size_ok = if parts.len() == 1 {
            !part.is_empty()
        } else if i == 0 {
            (1..=3).contains(&part.len())
        } else {
            part.len() == 3
        };
        size_ok && part.chars().all(|c| c.is_ascii_digit())
    });
    if !well_formed {
        return Err(invalid());
    }
    Ok(parts.concat())
}

/// Reads the text of an amount into scaled units of a commodity with `scale` decimals.
/// Digits beyond the scale are accepted only when they are zeros; anything else would be rounded
/// silently, so it is refused.
pub fn parse_amount(text: &str, scale: u8, separators: Separators) -> Result<i64> {
    check_scale(scale)?;
    let trimmed = text.trim_matches(|c: char| c.is_ascii_whitespace());
    let (negative, unsigned) = match trimmed.as_bytes().first() {
        Some(b'-') => (true, &trimmed[1..]),
        Some(b'+') => (false, &trimmed[1..]),
        _ => (false, trimmed),
    };
    let (integer_text, fraction) = match unsigned.split_once(separators.decimal) {
        Some((integer, fraction)) => (integer, fraction),
        None => (unsigned, ""),
    };
    if unsigned.contains(separators.decimal) && fraction.is_empty() {
        return Err(invalid());
    }
    if !fraction.chars().all(|c| c.is_ascii_digit()) {
        return Err(invalid());
    }
    let integer = strip_groups(integer_text, separators.group)?;
    let scale_len = usize::from(scale);
    let (kept, extra) = if fraction.len() > scale_len {
        fraction.split_at(scale_len)
    } else {
        (fraction, "")
    };
    if extra.chars().any(|c| c != '0') {
        return Err(Error::Rule(RuleCode::AmountTooPrecise));
    }
    let padded = format!("{integer}{kept}{}", "0".repeat(scale_len - kept.len()));
    let magnitude: i128 = padded
        .parse()
        .map_err(|_| Error::Rule(RuleCode::AmountOutOfRange))?;
    let signed = if negative { -magnitude } else { magnitude };
    i64::try_from(signed)
        .ok()
        .filter(|v| v.unsigned_abs() <= MAX_STORED_MAGNITUDE)
        .ok_or(Error::Rule(RuleCode::AmountOutOfRange))
}

/// Writes scaled units as text with exactly `scale` decimals. `scale` comes from a commodity, so it
/// is already at most 18; a value outside the stored bounds is formatted as it is.
pub fn format_amount(value: i64, scale: u8, separators: Separators) -> String {
    let digits = value.unsigned_abs().to_string();
    let scale_len = usize::from(scale);
    let padded = if digits.len() <= scale_len {
        format!("{}{digits}", "0".repeat(scale_len + 1 - digits.len()))
    } else {
        digits
    };
    let (integer, fraction) = padded.split_at(padded.len() - scale_len);
    let grouped = match separators.group {
        Some(mark) => group_thousands(integer, mark),
        None => integer.to_string(),
    };
    let sign = if value < 0 { "-" } else { "" };
    if scale_len == 0 {
        format!("{sign}{grouped}")
    } else {
        format!("{sign}{grouped}{}{fraction}", separators.decimal)
    }
}

fn group_thousands(integer: &str, mark: char) -> String {
    let mut out = String::with_capacity(integer.len() + integer.len() / 3);
    for (i, c) in integer.chars().enumerate() {
        if i > 0 && (integer.len() - i).is_multiple_of(3) {
            out.push(mark);
        }
        out.push(c);
    }
    out
}

#[cfg(test)]
mod tests {
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
}
