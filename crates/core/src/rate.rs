//! Rates and base values (ADR-0010): a rate is exact decimal text, the core computes `base_value`
//! from a quantity and a rate with one rounding rule (half away from zero), and a rate or base amount
//! given by the user always wins over a stored one. Rounding differences between converted lines go
//! to an explicit line on the Rounding account.

use std::fmt;

use crate::amount::{check_scale, pow10, MAX_STORED_MAGNITUDE};
use crate::error::{Error, Result, RuleCode};

/// A positive rate: 1 unit of the line's commodity is worth `rate` units of the book currency.
/// Stored as at most 19 significant digits and at most 18 decimals, without trailing zeros, so that
/// quantity times mantissa always fits an i128.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Rate {
    mantissa: u64,
    decimals: u8,
}

/// Decimals kept when a rate is derived from an amount and a base.
const IMPLIED_RATE_DECIMALS: u32 = 12;
const MAX_DECIMALS: usize = 18;
const MAX_DIGITS: usize = 19;

fn out_of_range() -> Error {
    Error::Rule(RuleCode::AmountOutOfRange)
}

/// n / d rounded half away from zero; `d` is positive.
fn div_round(n: i128, d: i128) -> i128 {
    let quotient = n / d;
    if 2 * (n % d).abs() >= d {
        quotient + n.signum()
    } else {
        quotient
    }
}

fn same_sign_nonzero(a: i64, b: i64) -> bool {
    a != 0 && b != 0 && (a > 0) == (b > 0)
}

fn in_stored_bounds(value: i128) -> Result<i64> {
    i64::try_from(value)
        .ok()
        .filter(|v| v.unsigned_abs() <= MAX_STORED_MAGNITUDE)
        .ok_or_else(out_of_range)
}

impl Rate {
    /// Reads the canonical text of a rate: digits with an optional single `.`, above zero.
    pub fn parse(text: &str) -> Result<Rate> {
        let invalid = || Error::Rule(RuleCode::RateInvalid);
        let (integer, fraction) = match text.split_once('.') {
            Some((integer, fraction)) if !fraction.is_empty() => (integer, fraction),
            Some(_) => return Err(invalid()),
            None => (text, ""),
        };
        let all_digits = |part: &str| part.bytes().all(|b| b.is_ascii_digit());
        if integer.is_empty() || !all_digits(integer) || !all_digits(fraction) {
            return Err(invalid());
        }
        let fraction = fraction.trim_end_matches('0');
        let digits = format!("{integer}{fraction}");
        let significant = digits.trim_start_matches('0');
        if significant.is_empty() || fraction.len() > MAX_DECIMALS || significant.len() > MAX_DIGITS
        {
            return Err(invalid());
        }
        // At most 19 digits, so the value stays below 10^19 and fits a u64.
        let mantissa = significant
            .bytes()
            .fold(0u64, |acc, digit| acc * 10 + u64::from(digit - b'0'));
        Ok(Rate {
            mantissa,
            decimals: fraction.len() as u8,
        })
    }

    /// The canonical text: no sign, no grouping, no trailing zeros.
    pub fn to_text(&self) -> String {
        let decimals = usize::from(self.decimals);
        if decimals == 0 {
            return self.mantissa.to_string();
        }
        let digits = format!("{:0>width$}", self.mantissa, width = decimals + 1);
        let (integer, fraction) = digits.split_at(digits.len() - decimals);
        format!("{integer}.{fraction}")
    }
}

impl fmt::Display for Rate {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.to_text())
    }
}

/// Quantity (scaled by `quantity_scale`) times rate, as base units (scaled by `base_scale`),
/// rounded half away from zero.
pub fn to_base(quantity: i64, quantity_scale: u8, rate: &Rate, base_scale: u8) -> Result<i64> {
    check_scale(quantity_scale)?;
    check_scale(base_scale)?;
    in_stored_bounds(i128::from(quantity))?;
    // |quantity| <= 2^62 and mantissa < 10^19, so the product fits an i128.
    let product = i128::from(quantity) * i128::from(rate.mantissa);
    let exponent = i32::from(base_scale) - i32::from(quantity_scale) - i32::from(rate.decimals);
    let scaled = if exponent >= 0 {
        product
            .checked_mul(pow10(exponent.unsigned_abs()))
            .ok_or_else(out_of_range)?
    } else {
        div_round(product, pow10(exponent.unsigned_abs()))
    };
    in_stored_bounds(scaled)
}

/// The rate that turns `quantity` into `base`: both nonzero and of the same sign, 12 decimals,
/// trailing zeros cut.
pub fn implied_rate(quantity: i64, quantity_scale: u8, base: i64, base_scale: u8) -> Result<Rate> {
    check_scale(quantity_scale)?;
    check_scale(base_scale)?;
    in_stored_bounds(i128::from(quantity))?;
    in_stored_bounds(i128::from(base))?;
    if quantity == 0 {
        return Err(Error::Rule(RuleCode::AmountInvalid));
    }
    if !same_sign_nonzero(quantity, base) {
        return Err(Error::Rule(RuleCode::LineBaseSign));
    }
    let invalid = || Error::Rule(RuleCode::RateInvalid);
    let scale_gap = i32::from(quantity_scale) - i32::from(base_scale);
    // An overflow here means the rate itself is far beyond 19 digits, so it is not representable.
    let numerator = i128::from(base.unsigned_abs())
        .checked_mul(pow10(
            IMPLIED_RATE_DECIMALS + scale_gap.max(0).unsigned_abs(),
        ))
        .ok_or_else(invalid)?;
    // |quantity| <= 2^62 and the power is at most 10^18, so this fits an i128.
    let denominator =
        i128::from(quantity.unsigned_abs()) * pow10((-scale_gap).max(0).unsigned_abs());
    let mut mantissa = div_round(numerator, denominator);
    if mantissa == 0 {
        return Err(invalid());
    }
    let mut decimals = IMPLIED_RATE_DECIMALS as u8;
    while decimals > 0 && mantissa % 10 == 0 {
        mantissa /= 10;
        decimals -= 1;
    }
    let mantissa = u64::try_from(mantissa).map_err(|_| invalid())?;
    if mantissa.to_string().len() > MAX_DIGITS {
        return Err(invalid());
    }
    Ok(Rate { mantissa, decimals })
}

/// A line in a commodity other than the book currency, as the user gave it.
///
/// `given_rate` and `given_base` may both be set only when they agree (see `resolve_line`).
#[derive(Debug, Clone, Copy)]
pub struct ForeignLine<'a> {
    pub quantity: i64,
    pub quantity_scale: u8,
    pub given_rate: Option<&'a Rate>,
    pub given_base: Option<i64>,
    /// The stored rate on or before the entry date, looked up by the caller.
    pub stored_rate: Option<&'a Rate>,
}

/// The base value and rate of a foreign line, and whether the core converted it (which is what
/// allows a rounding difference).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ResolvedLine {
    pub base_value: i64,
    pub rate: Rate,
    pub converted: bool,
}

/// A given rate or base is the user's own word and beats the stored rate. Given both, they must
/// agree: the base has to be what the rate yields, otherwise the line is refused
/// (`rate_base_conflict`) and the user chooses. Given neither, the stored rate is used; with none of
/// them the line cannot be valued (`rate_missing`). A base of zero or of the other sign is refused.
pub fn resolve_line(line: &ForeignLine<'_>, base_scale: u8) -> Result<ResolvedLine> {
    in_stored_bounds(i128::from(line.quantity))?;
    if line.quantity == 0 {
        return Err(Error::Rule(RuleCode::AmountInvalid));
    }
    let convert = |rate: &Rate| to_base(line.quantity, line.quantity_scale, rate, base_scale);
    if let Some(base) = line.given_base {
        in_stored_bounds(i128::from(base))?;
    }
    let (base_value, rate, converted) = if let Some(rate) = line.given_rate {
        let from_rate = convert(rate)?;
        if line.given_base.is_some_and(|base| base != from_rate) {
            return Err(Error::Rule(RuleCode::RateBaseConflict));
        }
        (from_rate, *rate, true)
    } else if let Some(base) = line.given_base {
        (
            base,
            implied_rate(line.quantity, line.quantity_scale, base, base_scale)?,
            false,
        )
    } else if let Some(rate) = line.stored_rate {
        (convert(rate)?, *rate, true)
    } else {
        return Err(Error::Rule(RuleCode::RateMissing));
    };
    if !same_sign_nonzero(line.quantity, base_value) {
        return Err(Error::Rule(RuleCode::LineBaseSign));
    }
    Ok(ResolvedLine {
        base_value,
        rate,
        converted,
    })
}

/// The base value of the Rounding line that balances an entry, or `None` when it already sums to
/// zero. A difference larger than one base unit per converted line is not rounding: it is refused.
/// One unit per line is the prototype's rule; the tightest bound a half-away rounding can produce is
/// half of that, so this tolerance is generous by design (open product decision for the owner).
pub fn rounding_line(base_values: &[i64], converted_lines: usize) -> Result<Option<i64>> {
    if converted_lines > base_values.len() {
        return Err(Error::Internal("more converted lines than lines"));
    }
    let difference: i128 = base_values.iter().map(|v| i128::from(*v)).sum();
    if difference == 0 {
        return Ok(None);
    }
    if difference.unsigned_abs() > converted_lines as u128 {
        return Err(Error::Rule(RuleCode::EntryUnbalanced));
    }
    Ok(Some(in_stored_bounds(-difference)?))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::amount::MAX_STORED;
    use proptest::prelude::*;

    type Expected = std::result::Result<(i64, &'static str, bool), RuleCode>;

    fn rate(text: &str) -> Rate {
        Rate::parse(text).unwrap()
    }

    fn code<T: fmt::Debug>(result: Result<T>) -> Option<RuleCode> {
        match result {
            Err(Error::Rule(c)) => Some(c),
            _ => None,
        }
    }

    #[test]
    fn the_code_helper_reports_only_rule_errors() {
        assert_eq!(code(Ok(1)), None);
        assert_eq!(code::<i64>(Err(Error::Internal("x"))), None);
    }

    #[test]
    fn a_rate_is_normalised_decimal_text() {
        assert_eq!(rate("34.1").to_text(), "34.1");
        assert_eq!(rate("34.10").to_text(), "34.1");
        assert_eq!(rate("34.0").to_text(), "34");
        assert_eq!(rate("034").to_text(), "34");
        assert_eq!(rate("0.000000000001").to_text(), "0.000000000001");
        assert_eq!(rate("0.5").to_string(), "0.5");
        assert_eq!(
            rate("1234567890.123456789"),
            rate("1234567890.123456789000")
        );
    }

    #[test]
    fn a_rate_refuses_anything_that_is_not_positive_decimal_text() {
        for bad in [
            "",
            "0",
            "0.0",
            "-1",
            "+1",
            "1,5",
            "1e3",
            ".5",
            "5.",
            "1.2.3",
            " 1",
            "abc",
            "12345678901234567890",
            "0.1234567890123456789",
        ] {
            assert_eq!(
                code(Rate::parse(bad)),
                Some(RuleCode::RateInvalid),
                "{bad:?}"
            );
        }
    }

    #[test]
    fn converts_with_one_rounding_rule_half_away_from_zero() {
        // 1 minor unit at 0.5: half a unit rounds away from zero, in both signs.
        assert_eq!(to_base(1, 2, &rate("0.5"), 2).unwrap(), 1);
        assert_eq!(to_base(-1, 2, &rate("0.5"), 2).unwrap(), -1);
        assert_eq!(to_base(1, 2, &rate("0.49"), 2).unwrap(), 0);
        // 100.00 USD at 34.1 is 3410.00 TRY.
        assert_eq!(to_base(10_000, 2, &rate("34.1"), 2).unwrap(), 341_000);
        // Different scales: 1000 JPY (scale 0) at 0.2234 TRY is 223.40 (scale 2).
        assert_eq!(to_base(1000, 0, &rate("0.2234"), 2).unwrap(), 22_340);
        // 1.5 units of an 18-decimals token at 2000.25 is 3000.375 -> 3000.38 (scale 2).
        assert_eq!(
            to_base(1_500_000_000_000_000_000, 18, &rate("2000.25"), 2).unwrap(),
            300_038
        );
        // The prototype case: one cent at 33.335 is 33 kuruş.
        assert_eq!(to_base(1, 2, &rate("33.335"), 2).unwrap(), 33);
    }

    #[test]
    fn a_result_beyond_the_stored_bounds_is_refused_not_wrapped() {
        let big = rate("9999999999999999999");
        assert_eq!(
            code(to_base(MAX_STORED, 0, &big, 0)),
            Some(RuleCode::AmountOutOfRange)
        );
        assert_eq!(
            code(to_base(1, 0, &rate("1"), 19)),
            Some(RuleCode::CommodityScaleInvalid)
        );
    }

    #[test]
    fn derives_the_rate_from_an_amount_and_a_base() {
        assert_eq!(implied_rate(10_000, 2, 340_000, 2).unwrap().to_text(), "34");
        assert_eq!(
            implied_rate(-10_000, 2, -341_000, 2).unwrap().to_text(),
            "34.1"
        );
        assert_eq!(
            implied_rate(1000, 0, 22_340, 2).unwrap().to_text(),
            "0.2234"
        );
        assert_eq!(
            implied_rate(3, 2, 10, 2).unwrap().to_text(),
            "3.333333333333"
        );
    }

    #[test]
    fn an_implied_rate_needs_same_sign_nonzero_amounts_and_at_least_1e_12() {
        assert_eq!(
            code(implied_rate(100, 2, -100, 2)),
            Some(RuleCode::LineBaseSign)
        );
        assert_eq!(
            code(implied_rate(100, 2, 0, 2)),
            Some(RuleCode::LineBaseSign)
        );
        assert_eq!(
            code(implied_rate(0, 2, 100, 2)),
            Some(RuleCode::AmountInvalid)
        );
        assert_eq!(
            code(implied_rate(i64::MAX / 2, 0, 1, 18)),
            Some(RuleCode::RateInvalid)
        );
        // Too large for 19 digits: between 1e19 and the u64 limit, and far above it.
        assert_eq!(
            code(implied_rate(3, 0, 36_000_001, 0)),
            Some(RuleCode::RateInvalid)
        );
        assert_eq!(
            code(implied_rate(2, 0, MAX_STORED - 1, 0)),
            Some(RuleCode::RateInvalid)
        );
        // The widest rate that still fits: trailing zeros are cut until 19 digits remain.
        assert_eq!(
            implied_rate(1, 0, MAX_STORED, 0).unwrap().to_text(),
            "4611686018427387904"
        );
        // A numerator that overflows means a rate far beyond 19 digits: refused, not a panic.
        assert_eq!(
            code(implied_rate(1, 18, MAX_STORED, 0)),
            Some(RuleCode::RateInvalid)
        );
    }

    #[test]
    fn a_stored_rate_is_used_when_nothing_is_given() {
        let stored = rate("34.1");
        let line = ForeignLine {
            quantity: -10_000,
            quantity_scale: 2,
            given_rate: None,
            given_base: None,
            stored_rate: Some(&stored),
        };
        let got = resolve_line(&line, 2).unwrap();
        assert_eq!(
            (got.base_value, got.rate.to_text(), got.converted),
            (-341_000, "34.1".to_string(), true)
        );
    }

    #[test]
    fn a_given_base_beats_the_stored_rate_and_the_rate_follows_from_it() {
        let stored = rate("30");
        let line = ForeignLine {
            quantity: -10_000,
            quantity_scale: 2,
            given_rate: None,
            given_base: Some(-340_000),
            stored_rate: Some(&stored),
        };
        let got = resolve_line(&line, 2).unwrap();
        assert_eq!(
            (got.base_value, got.rate.to_text(), got.converted),
            (-340_000, "34".to_string(), false)
        );
    }

    #[test]
    fn a_given_rate_beats_the_stored_rate() {
        let given = rate("35");
        let stored = rate("30");
        let line = ForeignLine {
            quantity: 100,
            quantity_scale: 2,
            given_rate: Some(&given),
            given_base: None,
            stored_rate: Some(&stored),
        };
        let got = resolve_line(&line, 2).unwrap();
        assert_eq!(
            (got.base_value, got.rate.to_text(), got.converted),
            (3500, "35".to_string(), true)
        );
    }

    #[test]
    fn a_given_rate_and_a_given_base_must_agree() {
        let given = rate("35");
        let line = |base| ForeignLine {
            quantity: 100,
            quantity_scale: 2,
            given_rate: Some(&given),
            given_base: Some(base),
            stored_rate: None,
        };
        // 1.00 at 35 is 35.00: the same base agrees.
        let got = resolve_line(&line(3500), 2).unwrap();
        assert_eq!(
            (got.base_value, got.rate.to_text()),
            (3500, "35".to_string())
        );
        // One unit off is a conflict, not rounding: the user must choose.
        assert_eq!(
            code(resolve_line(&line(3499), 2)),
            Some(RuleCode::RateBaseConflict)
        );
        assert_eq!(
            code(resolve_line(&line(999), 2)),
            Some(RuleCode::RateBaseConflict)
        );
        // A conflict is reported before the stored rate is looked at, and bounds still come first.
        assert_eq!(
            code(resolve_line(&line(MAX_STORED + 1), 2)),
            Some(RuleCode::AmountOutOfRange)
        );
    }

    #[test]
    fn scales_and_bounds_are_checked_on_every_path() {
        let one = rate("1");
        assert_eq!(
            code(to_base(1, 19, &one, 2)),
            Some(RuleCode::CommodityScaleInvalid)
        );
        assert_eq!(
            code(implied_rate(1, 19, 1, 2)),
            Some(RuleCode::CommodityScaleInvalid)
        );
        assert_eq!(
            code(implied_rate(1, 2, 1, 19)),
            Some(RuleCode::CommodityScaleInvalid)
        );
        let huge = rate("9999999999999999999");
        let converts_out_of_range = ForeignLine {
            quantity: MAX_STORED,
            quantity_scale: 0,
            given_rate: Some(&huge),
            given_base: None,
            stored_rate: None,
        };
        assert_eq!(
            code(resolve_line(&converts_out_of_range, 0)),
            Some(RuleCode::AmountOutOfRange)
        );
        let base_out_of_range = ForeignLine {
            quantity: 1,
            quantity_scale: 0,
            given_rate: None,
            given_base: Some(i64::MAX),
            stored_rate: None,
        };
        assert_eq!(
            code(resolve_line(&base_out_of_range, 0)),
            Some(RuleCode::AmountOutOfRange)
        );
    }

    #[test]
    fn a_line_with_no_rate_anywhere_is_refused() {
        let line = ForeignLine {
            quantity: 100,
            quantity_scale: 2,
            given_rate: None,
            given_base: None,
            stored_rate: None,
        };
        assert_eq!(code(resolve_line(&line, 2)), Some(RuleCode::RateMissing));
    }

    #[test]
    fn a_base_of_zero_or_of_the_wrong_sign_is_refused() {
        let tiny = rate("0.001");
        let rounds_to_zero = ForeignLine {
            quantity: 1,
            quantity_scale: 2,
            given_rate: Some(&tiny),
            given_base: None,
            stored_rate: None,
        };
        assert_eq!(
            code(resolve_line(&rounds_to_zero, 2)),
            Some(RuleCode::LineBaseSign)
        );
        let wrong_sign = ForeignLine {
            quantity: 100,
            quantity_scale: 2,
            given_rate: None,
            given_base: Some(-100),
            stored_rate: None,
        };
        assert_eq!(
            code(resolve_line(&wrong_sign, 2)),
            Some(RuleCode::LineBaseSign)
        );
        let zero_quantity = ForeignLine {
            quantity: 0,
            quantity_scale: 2,
            given_rate: None,
            given_base: Some(100),
            stored_rate: None,
        };
        assert_eq!(
            code(resolve_line(&zero_quantity, 2)),
            Some(RuleCode::AmountInvalid)
        );
    }

    #[test]
    fn rounding_differences_go_to_a_line_but_real_imbalance_is_refused() {
        // Two cents converted at 33.335 give 33 + 33; the other leg is -67: the Rounding line is +1.
        assert_eq!(rounding_line(&[33, 33, -67], 2).unwrap(), Some(1));
        assert_eq!(rounding_line(&[3410, -3410], 1).unwrap(), None);
        assert_eq!(
            code(rounding_line(&[33, -40], 1)),
            Some(RuleCode::EntryUnbalanced)
        );
        assert_eq!(
            code(rounding_line(&[1, 0], 0)),
            Some(RuleCode::EntryUnbalanced)
        );
        assert_eq!(
            code(rounding_line(&[i64::MAX, i64::MAX, i64::MAX], 3)),
            Some(RuleCode::EntryUnbalanced)
        );
    }

    #[test]
    fn the_prototype_cases_hold() {
        // legacy/src/core/money.test.ts
        assert_eq!(to_base(1234, 2, &rate("35"), 0).unwrap(), 432);
        assert_eq!(to_base(-10_000, 2, &rate("34.1"), 2).unwrap(), -341_000);
        assert_eq!(to_base(1000, 0, &rate("0.2155"), 2).unwrap(), 21_550);
        assert_eq!(
            implied_rate(-10_000, 2, -341_050, 2).unwrap().to_text(),
            "34.105"
        );
        let derived = implied_rate(1000, 0, 21_550, 2).unwrap();
        assert_eq!(derived.to_text(), "0.2155");
        assert_eq!(to_base(1000, 0, &derived, 2).unwrap(), 21_550);
    }

    #[test]
    fn an_implied_rate_rounds_half_away_in_both_signs_and_both_scale_directions() {
        assert_eq!(
            implied_rate(3, 2, 20, 2).unwrap().to_text(),
            "6.666666666667"
        );
        assert_eq!(
            implied_rate(-3, 2, -20, 2).unwrap().to_text(),
            "6.666666666667"
        );
        assert_eq!(
            implied_rate(3, 0, 20, 2).unwrap().to_text(),
            "0.066666666667"
        );
        assert_eq!(
            implied_rate(300, 2, 20, 0).unwrap().to_text(),
            "6.666666666667"
        );
    }

    #[test]
    fn a_quantity_beyond_the_stored_bounds_is_refused_on_every_path() {
        let half = rate("0.5");
        let too_big = MAX_STORED + 1;
        assert_eq!(
            code(to_base(i64::MAX, 0, &half, 0)),
            Some(RuleCode::AmountOutOfRange)
        );
        assert_eq!(
            code(to_base(i64::MIN, 0, &half, 0)),
            Some(RuleCode::AmountOutOfRange)
        );
        assert_eq!(
            code(implied_rate(too_big, 0, 1, 0)),
            Some(RuleCode::AmountOutOfRange)
        );
        assert_eq!(
            code(implied_rate(1, 0, too_big, 0)),
            Some(RuleCode::AmountOutOfRange)
        );
        let line = ForeignLine {
            quantity: too_big,
            quantity_scale: 0,
            given_rate: Some(&half),
            given_base: None,
            stored_rate: None,
        };
        assert_eq!(
            code(resolve_line(&line, 0)),
            Some(RuleCode::AmountOutOfRange)
        );
        let at_the_bound = ForeignLine {
            quantity: MAX_STORED,
            quantity_scale: 0,
            given_rate: Some(&half),
            given_base: None,
            stored_rate: None,
        };
        assert_eq!(
            resolve_line(&at_the_bound, 0).unwrap().base_value,
            MAX_STORED / 2
        );
    }

    #[test]
    fn a_rate_text_has_exact_edges() {
        for good in [
            "9999999999999999999",
            "0.123456789012345678",
            "0.1000000000000000000",
            "00.5",
        ] {
            assert!(Rate::parse(good).is_ok(), "{good:?}");
        }
        assert_eq!(rate("0.1000000000000000000").to_text(), "0.1");
        assert_eq!(rate("00.5").to_text(), "0.5");
        for bad in [
            "00",
            "0.000",
            "00.0",
            "٣",
            "１",
            "1\n",
            "1.5 ",
            "1.5e3",
            "0.0000000000000000001",
        ] {
            assert_eq!(
                code(Rate::parse(bad)),
                Some(RuleCode::RateInvalid),
                "{bad:?}"
            );
        }
    }

    #[test]
    fn the_resolution_order_holds_for_every_combination() {
        let given = rate("35");
        let stored = rate("30");
        // (given rate, given base 34.00, stored rate) -> (base_value, rate, converted) or the refusal.
        let table: [(bool, bool, bool, Expected); 8] = [
            (true, true, true, Err(RuleCode::RateBaseConflict)),
            (true, true, false, Err(RuleCode::RateBaseConflict)),
            (true, false, true, Ok((3500, "35", true))),
            (true, false, false, Ok((3500, "35", true))),
            (false, true, true, Ok((3400, "34", false))),
            (false, true, false, Ok((3400, "34", false))),
            (false, false, true, Ok((3000, "30", true))),
            (false, false, false, Err(RuleCode::RateMissing)),
        ];
        for (has_rate, has_base, has_stored, want) in table {
            let line = ForeignLine {
                quantity: 100,
                quantity_scale: 2,
                given_rate: has_rate.then_some(&given),
                given_base: has_base.then_some(3400),
                stored_rate: has_stored.then_some(&stored),
            };
            let got = resolve_line(&line, 2);
            match want {
                Ok((base, text, converted)) => {
                    let got = got.unwrap();
                    assert_eq!(
                        (got.base_value, got.rate.to_text(), got.converted),
                        (base, text.to_string(), converted),
                        "{has_rate} {has_base} {has_stored}"
                    );
                }
                Err(refusal) => assert_eq!(
                    code(got),
                    Some(refusal),
                    "{has_rate} {has_base} {has_stored}"
                ),
            }
        }
    }

    #[test]
    fn a_given_base_at_a_different_scale_implies_the_right_rate() {
        // 100.00 units (scale 2) given as 3400 units (scale 0): rate 34.
        let line = ForeignLine {
            quantity: 10_000,
            quantity_scale: 2,
            given_rate: None,
            given_base: Some(3400),
            stored_rate: None,
        };
        assert_eq!(resolve_line(&line, 0).unwrap().rate.to_text(), "34");
        let line = ForeignLine {
            quantity: 100,
            quantity_scale: 0,
            given_rate: None,
            given_base: Some(340_000),
            stored_rate: None,
        };
        assert_eq!(resolve_line(&line, 2).unwrap().rate.to_text(), "34");
        let on_the_bound = ForeignLine {
            quantity: 1,
            quantity_scale: 0,
            given_rate: None,
            given_base: Some(MAX_STORED),
            stored_rate: None,
        };
        assert_eq!(
            resolve_line(&on_the_bound, 0).unwrap().base_value,
            MAX_STORED
        );
        let over_the_bound = ForeignLine {
            given_base: Some(MAX_STORED + 1),
            ..on_the_bound
        };
        assert_eq!(
            code(resolve_line(&over_the_bound, 0)),
            Some(RuleCode::AmountOutOfRange)
        );
    }

    #[test]
    fn rounding_line_edge_cases() {
        assert_eq!(rounding_line(&[], 0).unwrap(), None);
        assert!(matches!(
            rounding_line(&[1, -1], 3),
            Err(Error::Internal(_))
        ));
        // The Rounding line itself must fit the stored bounds.
        assert_eq!(
            code(rounding_line(&[MAX_STORED, MAX_STORED, MAX_STORED], 3)),
            Some(RuleCode::EntryUnbalanced)
        );
    }

    proptest! {
        #[test]
        fn a_rate_of_one_at_equal_scales_changes_nothing(q in -MAX_STORED..=MAX_STORED, scale in 0u8..=18) {
            prop_assert_eq!(to_base(q, scale, &rate("1"), scale).unwrap(), q);
        }

        #[test]
        fn a_power_of_ten_rate_only_moves_the_decimal_point(q in -MAX_STORED..=MAX_STORED, scale in 1u8..=18) {
            prop_assert_eq!(to_base(q, scale, &rate("1"), scale - 1).unwrap(), {
                let exact = i128::from(q);
                let rounded = (exact.abs() + 5) / 10 * exact.signum();
                i64::try_from(rounded).unwrap()
            });
        }

        // An independent check of the rounding rule: the result is the nearest integer to the exact
        // product, and a tie goes away from zero. Exact products are computed in i128.
        #[test]
        fn the_result_is_the_nearest_integer_with_ties_away_from_zero(
            q in -1_000_000_000i64..=1_000_000_000,
            qs in 0u8..=6,
            bs in 0u8..=6,
            mantissa in 1u64..1_000_000_000,
            decimals in 0u32..=6,
        ) {
            // The rate is mantissa / 10^decimals, built here without the parser's normalisation.
            let digits = format!("{mantissa:0>10}");
            let (whole, fraction) = digits.split_at(digits.len() - decimals as usize);
            let text = if decimals == 0 { whole.to_string() } else { format!("{whole}.{fraction}") };
            let r = Rate::parse(&text).unwrap();
            // exact value = q * mantissa * 10^(bs - qs - decimals) = num / den
            let exponent = i32::from(bs) - i32::from(qs) - decimals as i32;
            let product = i128::from(q) * i128::from(mantissa);
            let (num, den) = if exponent >= 0 {
                (product * 10i128.pow(exponent as u32), 1)
            } else {
                (product, 10i128.pow((-exponent) as u32))
            };
            match to_base(q, qs, &r, bs) {
                Ok(base) => {
                    let got = i128::from(base);
                    prop_assert!(2 * (got * den - num).abs() <= den, "not the nearest: {got} for {num}/{den}");
                    if 2 * (num % den).abs() == den {
                        prop_assert!(got.abs() > (num / den).abs(), "tie not away from zero: {got} for {num}/{den}");
                    }
                }
                // A refusal must be justified: the value really is beyond the stored bounds.
                Err(Error::Rule(RuleCode::AmountOutOfRange)) => {
                    prop_assert!((num / den).unsigned_abs() >= u128::from(MAX_STORED_MAGNITUDE), "refused {num}/{den}");
                }
                Err(other) => prop_assert!(false, "unexpected {:?}", other),
            }
        }

        #[test]
        fn conversion_is_monotonic(
            a in -1_000_000_000i64..=1_000_000_000,
            b in -1_000_000_000i64..=1_000_000_000,
            mantissa in 1u64..1_000_000_000,
        ) {
            let r = Rate::parse(&format!("{mantissa}.5")).unwrap();
            let (lo, hi) = (a.min(b), a.max(b));
            prop_assert!(to_base(lo, 2, &r, 2).unwrap() <= to_base(hi, 2, &r, 2).unwrap());
        }

        #[test]
        fn conversion_is_symmetric_around_zero(q in 1..=MAX_STORED, mantissa in 1u64..1_000_000_000_000, qs in 0u8..=18, bs in 0u8..=18) {
            let digits = format!("{mantissa:0>10}");
            let r = Rate::parse(&format!("{}.{}", &digits[..digits.len() - 9], &digits[digits.len() - 9..])).unwrap();
            match (to_base(q, qs, &r, bs), to_base(-q, qs, &r, bs)) {
                (Ok(a), Ok(b)) => prop_assert_eq!(a, -b),
                (Err(Error::Rule(a)), Err(Error::Rule(b))) => prop_assert_eq!(a, b),
                other => prop_assert!(false, "asymmetric: {:?}", other),
            }
        }

        #[test]
        fn a_value_that_fits_is_never_refused(
            q in -MAX_STORED..=MAX_STORED,
            mantissa in 1u64..10_000_000_000_000_000_000,
            qs in 0u8..=18,
            bs in 0u8..=18,
        ) {
            // Whatever the result is, it is either in the stored bounds or the one refusal for it.
            let r = Rate::parse(&mantissa.to_string()).unwrap();
            match to_base(q, qs, &r, bs) {
                Ok(base) => prop_assert!(base.unsigned_abs() <= MAX_STORED_MAGNITUDE),
                Err(Error::Rule(code)) => prop_assert_eq!(code, RuleCode::AmountOutOfRange),
                Err(other) => prop_assert!(false, "unexpected {:?}", other),
            }
        }

        #[test]
        fn the_text_of_a_rate_parses_back_to_the_same_rate(mantissa in 1u64..10_000_000_000_000_000_000, decimals in 0usize..=18) {
            let digits = format!("{mantissa:0>19}");
            let (int, frac) = digits.split_at(digits.len() - decimals);
            let text = if decimals == 0 { int.to_string() } else { format!("{int}.{frac}") };
            let r = Rate::parse(&text).unwrap();
            prop_assert_eq!(Rate::parse(&r.to_text()).unwrap(), r);
        }

        #[test]
        fn parsing_a_rate_never_panics(text in "[0-9.+\\- ]{0,25}") {
            let _ = Rate::parse(&text);
        }

        #[test]
        fn the_rounding_line_always_balances_the_entry(
            mut bases in proptest::collection::vec(-1000i64..1000, 1..8),
            noise in -4i64..=4,
            converted in 0usize..8,
        ) {
            // A nearly balanced entry: the last line cancels the others up to a small difference.
            let sum: i64 = bases.iter().sum();
            bases.push(-sum + noise);
            let converted = converted.min(bases.len());
            match rounding_line(&bases, converted) {
                Ok(extra) => {
                    let total: i128 = bases.iter().map(|b| i128::from(*b)).sum::<i128>()
                        + i128::from(extra.unwrap_or(0));
                    prop_assert_eq!(total, 0);
                    prop_assert_eq!(extra.is_none(), noise == 0);
                    prop_assert!(i128::from(noise).unsigned_abs() <= converted as u128);
                }
                Err(e) => {
                    prop_assert!(matches!(e, Error::Rule(RuleCode::EntryUnbalanced)));
                    prop_assert!(i128::from(noise).unsigned_abs() > converted as u128);
                }
            }
        }

        #[test]
        fn large_sums_never_wrap(bases in proptest::collection::vec(i64::MIN / 4..i64::MAX / 4, 1..9)) {
            let exact: i128 = bases.iter().map(|b| i128::from(*b)).sum();
            match rounding_line(&bases, bases.len()) {
                Ok(None) => prop_assert_eq!(exact, 0),
                Ok(Some(extra)) => prop_assert_eq!(i128::from(extra), -exact),
                Err(Error::Rule(RuleCode::EntryUnbalanced)) => prop_assert!(exact.unsigned_abs() > bases.len() as u128),
                Err(other) => prop_assert!(false, "unexpected {:?}", other),
            }
        }
    }
}
