//! The official calculators (ADR-0024): converting an amount between two commodities through the
//! book currency, and the cross rate of two rates; exact, rounded half away from zero, never float.

use super::*;
use crate::error::RuleCode;

fn rate(text: &str) -> Rate {
    Rate::parse(text).unwrap()
}

fn code<T: std::fmt::Debug>(result: Result<T>) -> Option<RuleCode> {
    match result {
        Err(Error::Rule(code)) => Some(code),
        other => panic!("expected a rule error, got {other:?}"),
    }
}

#[test]
fn a_foreign_amount_converts_into_the_book_currency_with_its_rate() {
    // Arrange
    let usd = Side::foreign(2, rate("35"));
    // Act
    let base = convert(1_000, usd, Side::BASE, 2).unwrap();
    // Assert
    assert_eq!(base, 35_000);
}

#[test]
fn a_book_currency_amount_converts_into_a_foreign_one_with_its_rate() {
    // Arrange
    let usd = Side::foreign(2, rate("35"));
    // Act
    let dollars = convert(35_000, Side::BASE, usd, 2).unwrap();
    let rounded = convert(100, Side::BASE, usd, 2).unwrap();
    let negative = convert(-100, Side::BASE, usd, 2).unwrap();
    // Assert
    assert_eq!(dollars, 1_000);
    assert_eq!(rounded, 3, "1.00 / 35 = 0.0286, rounded to 0.03");
    assert_eq!(negative, -3);
}

#[test]
fn two_foreign_currencies_convert_through_the_book_currency() {
    // Arrange
    let usd = Side::foreign(2, rate("35"));
    let eur = Side::foreign(2, rate("38"));
    // Act
    let euros = convert(1_000, usd, eur, 2).unwrap();
    // Assert
    assert_eq!(euros, 921, "10.00 USD = 350.00 TRY = 9.2105 EUR");
}

#[test]
fn scales_of_both_sides_are_respected() {
    // Arrange
    let gold = Side::foreign(3, rate("2500.5"));
    let yen = Side::foreign(0, rate("0.25"));
    // Act
    let base = convert(1_500, gold, Side::BASE, 2).unwrap();
    let yens = convert(1_000, Side::BASE, yen, 2).unwrap();
    // Assert
    assert_eq!(base, 375_075, "1.500 g at 2500.5 = 3750.75");
    assert_eq!(yens, 40, "10.00 / 0.25 = 40");
}

#[test]
fn the_same_side_on_both_ends_keeps_the_amount() {
    // Act / Assert
    assert_eq!(convert(1_234, Side::BASE, Side::BASE, 2).unwrap(), 1_234);
}

#[test]
fn a_result_beyond_the_stored_range_is_refused() {
    // Arrange
    let tiny = Side::foreign(18, rate("0.000000000000000001"));
    // Act
    let result = convert(i64::MAX / 4, Side::BASE, tiny, 18);
    // Assert
    assert_eq!(code(result), Some(RuleCode::AmountOutOfRange));
}

#[test]
fn the_cross_rate_is_one_rate_divided_by_the_other() {
    // Act
    let usd_in_eur = cross_rate(&rate("35"), &rate("38")).unwrap();
    let third = cross_rate(&rate("1"), &rate("3")).unwrap();
    let exact = cross_rate(&rate("38.5"), &rate("1.1")).unwrap();
    // Assert
    assert_eq!(usd_in_eur.to_text(), "0.921052631579");
    assert_eq!(third.to_text(), "0.333333333333");
    assert_eq!(exact.to_text(), "35");
}

#[test]
fn a_cross_rate_that_cannot_be_written_is_refused() {
    // Arrange
    let huge = rate("9999999999999999999");
    let tiny = rate("0.000000000000000001");
    // Act / Assert
    assert_eq!(code(cross_rate(&huge, &tiny)), Some(RuleCode::RateInvalid));
    assert_eq!(code(cross_rate(&tiny, &huge)), Some(RuleCode::RateInvalid));
}
