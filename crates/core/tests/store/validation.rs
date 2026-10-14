//! Input checks and stable error codes: duplicate codes, scale and amount bounds, missing references and malformed bodies are refused with a code, never an opaque database error.

use super::common::*;

#[test]
fn a_duplicate_commodity_code_scale_range_and_amount_bound_have_codes() {
    // Arrange
    let mut w = world();
    let amount = json!({"date": "2026-10-13", "status": "draft", "lines": [
        {"account": w.food.to_string(), "commodity": w.try_id.to_string(), "quantity": 4_611_686_018_427_387_905_i64, "base_value": 1}]});
    // Act
    let dup = w.store.write_revision(rev(
        DocKind::Commodity,
        new_id(),
        None,
        json!({"code": "TRY", "scale": 2}),
    ));
    let scale = w.store.write_revision(rev(
        DocKind::Commodity,
        new_id(),
        None,
        json!({"code": "ABC", "scale": 19}),
    ));
    let big = w
        .store
        .write_revision(rev(DocKind::Entry, new_id(), None, amount));
    let date = w.store.write_revision(rev(
        DocKind::Entry,
        new_id(),
        None,
        json!({"date": "2026-99-99", "status": "draft", "lines": []}),
    ));
    // Assert
    assert!(matches!(
        dup,
        Err(Error::Rule(RuleCode::CommodityCodeTaken))
    ));
    assert!(matches!(
        scale,
        Err(Error::Rule(RuleCode::CommodityScaleInvalid))
    ));
    assert!(matches!(big, Err(Error::Rule(RuleCode::AmountOutOfRange))));
    assert!(matches!(date, Err(Error::Rule(RuleCode::DateInvalid))));
}

#[test]
fn a_summed_overflow_is_an_amount_error_not_an_opaque_one() {
    // Arrange
    let mut w = world();
    let big = 4_611_686_018_427_387_904_i64;
    let body = entry_body(
        &w,
        "posted",
        &[(w.food, big), (w.cash, big), (w.food, big), (w.cash, big)],
    );
    // Act
    let result = w
        .store
        .write_revision(rev(DocKind::Entry, new_id(), None, body));
    // Assert
    assert!(matches!(
        result,
        Err(Error::Rule(RuleCode::AmountOutOfRange))
    ));
}

#[test]
fn a_missing_account_reference_is_reported() {
    // Arrange
    let mut w = world();
    let body = entry_body(&w, "draft", &[(new_id(), 5000)]);
    // Act
    let result = w
        .store
        .write_revision(rev(DocKind::Entry, new_id(), None, body));
    // Assert
    assert!(matches!(
        result,
        Err(Error::MissingReference {
            kind: "account",
            ..
        })
    ));
}

#[test]
fn a_missing_commodity_reference_is_reported() {
    // Arrange
    let mut w = world();
    let body = account_body("Orphan", new_id(), None, false);
    // Act
    let result = w
        .store
        .write_revision(rev(DocKind::Account, new_id(), None, body));
    // Assert
    assert!(matches!(
        result,
        Err(Error::MissingReference {
            kind: "commodity",
            ..
        })
    ));
}

#[test]
fn malformed_unknown_or_misspelled_bodies_are_refused() {
    // Arrange
    let mut w = world();
    let (food, cash) = (w.food, w.cash);
    let good = entry_body(&w, "posted", &[(food, 100), (cash, -100)]);
    let mut typo_field = good.clone();
    typo_field["memoo"] = json!("rent");
    let mut typo_status = good.clone();
    typo_status["status"] = json!("Posted");
    // Act
    let nonsense = w.store.write_revision(rev(
        DocKind::Entry,
        new_id(),
        None,
        json!({"nonsense": true}),
    ));
    let field = w
        .store
        .write_revision(rev(DocKind::Entry, new_id(), None, typo_field));
    let status = w
        .store
        .write_revision(rev(DocKind::Entry, new_id(), None, typo_status));
    // Assert
    assert!(matches!(nonsense, Err(Error::InvalidBody(_))));
    assert!(matches!(field, Err(Error::InvalidBody(_))));
    assert!(matches!(status, Err(Error::InvalidBody(_))));
}
