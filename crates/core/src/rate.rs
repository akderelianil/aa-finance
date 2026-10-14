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
mod tests;
