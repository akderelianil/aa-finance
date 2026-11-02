//! The official calculators of scenarios (ADR-0024): v1 has `convert` and `cross_rate` only. Both
//! use exact integer arithmetic and round half away from zero; a value they cannot hold is an
//! error, never a wrap.

use crate::amount::{check_scale, pow10};
use crate::error::{Error, Result, RuleCode};
use crate::rate::{div_round, in_stored_bounds, to_base, Rate, IMPLIED_RATE_DECIMALS};

/// One end of a conversion: a foreign commodity's scale and its rate to the book currency, or the
/// book currency itself.
#[derive(Debug, Clone, Copy)]
pub struct Side {
    foreign: Option<(u8, Rate)>,
}

impl Side {
    pub const BASE: Side = Side { foreign: None };

    pub fn foreign(scale: u8, rate: Rate) -> Side {
        Side {
            foreign: Some((scale, rate)),
        }
    }
}

/// Converts a quantity of `from` into `to` through the book currency: first to its value in the
/// book currency, then into `to`. Each step rounds half away from zero.
pub fn convert(quantity: i64, from: Side, to: Side, base_scale: u8) -> Result<i64> {
    let base = match from.foreign {
        None => quantity,
        Some((scale, rate)) => to_base(quantity, scale, &rate, base_scale)?,
    };
    match to.foreign {
        None => Ok(base),
        Some((scale, rate)) => from_base(base, base_scale, &rate, scale),
    }
}

/// A value in the book currency as a quantity of a commodity with the given rate.
fn from_base(base: i64, base_scale: u8, rate: &Rate, scale: u8) -> Result<i64> {
    check_scale(scale)?;
    check_scale(base_scale)?;
    let (mantissa, decimals) = rate.parts();
    let out_of_range = || Error::Rule(RuleCode::AmountOutOfRange);
    let exponent = i32::from(scale) + i32::from(decimals) - i32::from(base_scale);
    let numerator = i128::from(base)
        .checked_mul(pow10(exponent.max(0).unsigned_abs()))
        .ok_or_else(out_of_range)?;
    // The mantissa is below 10^19 and the power at most 10^18, so this fits an i128.
    let denominator = i128::from(mantissa) * pow10((-exponent).max(0).unsigned_abs());
    in_stored_bounds(div_round(numerator, denominator))
}

/// The rate of `a` in units of `b` (`a / b`), with 12 decimals.
pub fn cross_rate(a: &Rate, b: &Rate) -> Result<Rate> {
    let invalid = || Error::Rule(RuleCode::RateInvalid);
    let (a_mantissa, a_decimals) = a.parts();
    let (b_mantissa, b_decimals) = b.parts();
    let numerator = i128::from(a_mantissa)
        .checked_mul(pow10(IMPLIED_RATE_DECIMALS + u32::from(b_decimals)))
        .ok_or_else(invalid)?;
    // Below 10^19 times at most 10^18, so this fits an i128.
    let denominator = i128::from(b_mantissa) * pow10(u32::from(a_decimals));
    Rate::from_parts(div_round(numerator, denominator), IMPLIED_RATE_DECIMALS)
}

#[cfg(test)]
mod tests;
