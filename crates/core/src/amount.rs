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
mod tests;
