//! Currencies and rates in scenario drafts (ADR-0024): a foreign line asks for exactly the rate it
//! needs, two rates for one currency must agree, a transfer between currencies takes its value from
//! the source, a debt in dollars opens a dollar account under its group, and a hidden copy of an
//! amount cannot differ from it.

use super::common::*;
use aa_core::body::AccountKind::{Asset, Expense};
use serde_json::json;

#[test]
fn split_rows_in_two_currencies_are_refused() {
    // Arrange
    let mut b = book();
    let market = open(&mut b.ledger, "Market", Expense, b.try_id);
    let travel = open(&mut b.ledger, "Travel", Expense, b.usd_id);
    let items = json!([
        { "expense": pick(market), "part": "3.00" },
        { "expense": pick(travel), "part": "2.00" },
    ]);
    // Act
    let error = only_error(&b, "expense", set(expense(&b, market), "items", items));
    // Assert
    assert_eq!(error, (Some("items".into()), "mixed_commodities".into()));
}

#[test]
fn a_foreign_expense_account_asks_for_its_own_rate_and_then_takes_it() {
    // Arrange
    let mut b = book();
    let travel = open(&mut b.ledger, "Travel", Expense, b.usd_id);
    let inputs = expense(&b, travel);
    // Act
    let without = only_error(&b, "expense", inputs.clone());
    let with = draft(&b, "expense", set(inputs, "expense_rate", json!("25")));
    // Assert
    assert_eq!(without, (Some("expense_rate".into()), "rate_needed".into()));
    assert_eq!(
        post_draft(&mut b, &with),
        vec![
            (travel, "0.20".into(), "5.00".into()),
            (b.cash, "-5.00".into(), "-5.00".into()),
        ]
    );
}

#[test]
fn a_transfer_between_two_foreign_currencies_asks_for_the_source_rate() {
    // Arrange
    let mut b = book();
    let eur = b.ledger.create_commodity("EUR", 2).unwrap().doc_id;
    let dollars = open(&mut b.ledger, "Dollars", Asset, b.usd_id);
    let euros = open(&mut b.ledger, "Euros", Asset, eur);
    // Act
    let draft = draft(
        &b,
        "transfer",
        json!({
            "amount": "10.00", "from": pick(dollars), "to": pick(euros),
            "amount_in": "9.00", "date": "2026-11-02",
        }),
    );
    // Assert
    assert_eq!(
        errors(&draft),
        vec![(Some("from_rate".into()), "rate_needed".into())]
    );
}

#[test]
fn a_fee_in_dollars_is_charged_to_the_fee_account_in_lira() {
    // Arrange
    let mut b = book();
    let dollars = open(&mut b.ledger, "Dollars", Asset, b.usd_id);
    let other = open(&mut b.ledger, "Other dollars", Asset, b.usd_id);
    let fees = b.ledger.system_account("bank_fee").unwrap();
    // Act
    let draft = draft(
        &b,
        "transfer",
        json!({
            "amount": "100.00", "from": pick(dollars), "to": pick(other), "fee": "1.00",
            "from_rate": "35", "date": "2026-11-02", "memo": "wire",
        }),
    );
    // Assert
    assert_eq!(
        post_draft(&mut b, &draft),
        vec![
            (dollars, "-100.00".into(), "-3500.00".into()),
            (other, "100.00".into(), "3500.00".into()),
            (dollars, "-1.00".into(), "-35.00".into()),
            (fees, "35.00".into(), "35.00".into()),
        ]
    );
}

#[test]
fn borrowing_dollars_gives_the_payable_line_a_negative_base_value() {
    // Arrange
    let mut b = book();
    let dollars = open(&mut b.ledger, "Dollars", Asset, b.usd_id);
    let inputs = json!({
        "direction": "borrow", "person": { "new": "Ahmet" }, "money": pick(dollars),
        "money_rate": "35", "amount": "100.00", "date": "2026-11-02",
    });
    // Act
    let draft = draft(&b, "debt", inputs);
    // Assert
    let child = draft.entry().unwrap().create_accounts[0].id;
    assert_eq!(
        post_draft(&mut b, &draft),
        vec![
            (dollars, "100.00".into(), "3500.00".into()),
            (child, "-100.00".into(), "-3500.00".into()),
        ]
    );
}

#[test]
fn a_same_currency_transfer_refuses_an_amount_in_that_differs() {
    // Arrange
    let mut b = book();
    let bank = open(&mut b.ledger, "Bank", Asset, b.try_id);
    let inputs = json!({
        "amount": "100.00", "from": pick(bank), "to": pick(b.cash),
        "amount_in": "90.00", "date": "2026-11-02",
    });
    // Act
    let differs = only_error(&b, "transfer", inputs.clone());
    let same = draft(&b, "transfer", set(inputs, "amount_in", json!("100.00")));
    // Assert
    assert_eq!(differs, (Some("amount_in".into()), "invalid".into()));
    assert!(same.errors().is_empty());
}

#[test]
fn a_transfer_between_two_foreign_currencies_values_both_sides_at_the_rate_given_for_the_source() {
    // Arrange
    let mut b = book();
    let eur = b.ledger.create_commodity("EUR", 2).unwrap().doc_id;
    let dollars = open(&mut b.ledger, "Dollars", Asset, b.usd_id);
    let euros = open(&mut b.ledger, "Euros", Asset, eur);
    // Act
    let draft = draft(
        &b,
        "transfer",
        json!({
            "amount": "10.00", "from": pick(dollars), "to": pick(euros), "amount_in": "9.00",
            "from_rate": "35", "date": "2026-11-02",
        }),
    );
    // Assert
    assert_eq!(
        post_draft(&mut b, &draft),
        vec![
            (dollars, "-10.00".into(), "-350.00".into()),
            (euros, "9.00".into(), "350.00".into()),
        ]
    );
}

#[test]
fn a_missing_rate_on_a_dollar_debt_is_one_error_on_the_rate() {
    // Arrange
    let mut b = book();
    let dollars = open(&mut b.ledger, "Dollars", Asset, b.usd_id);
    // Act
    let error = only_error(&b, "debt", set(debt(&b), "money", pick(dollars)));
    // Assert
    assert_eq!(error, (Some("money_rate".into()), "rate_needed".into()));
}

#[test]
fn two_rates_for_one_currency_that_differ_are_refused() {
    // Arrange
    let mut b = book();
    let travel = open(&mut b.ledger, "Travel", Expense, b.usd_id);
    let card = open(
        &mut b.ledger,
        "Dollar card",
        aa_core::body::AccountKind::Liability,
        b.usd_id,
    );
    let inputs = json!({
        "amount": "5.00", "payment": pick(card), "payment_rate": "35", "expense_rate": "36",
        "date": "2026-11-02", "items": [{ "expense": pick(travel), "part": "5.00" }],
    });
    // Act
    let differ = only_error(&b, "expense", inputs.clone());
    let agree = draft(&b, "expense", set(inputs, "expense_rate", json!("35.0")));
    // Assert
    assert_eq!(differ, (Some("expense_rate".into()), "invalid".into()));
    assert!(agree.errors().is_empty());
}
