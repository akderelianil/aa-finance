//! Golden drafts of Gider and Gelir (ux/gider.md, ux/gelir.md, ADR-0024): the built-in scenario
//! turns the form into the lines the UX documents, a new account name opens with the entry, a
//! split must add up, a foreign payment needs its rate, and the draft posts as it is.

use super::common::*;
use aa_core::body::AccountKind::{Asset, Expense, Income, Liability};
use serde_json::json;

#[test]
fn a_cash_expense_debits_the_expense_and_credits_the_cash() {
    // Arrange
    let mut b = book();
    let market = open(&mut b.ledger, "Market", Expense, b.try_id);
    // Act
    let draft = draft(
        &b,
        "expense",
        json!({
            "amount": "500.00", "payment": pick(b.cash), "date": "2026-11-02",
            "items": [{ "expense": pick(market), "part": "500.00" }],
        }),
    );
    // Assert
    let preview = draft.preview.clone().unwrap();
    assert_eq!(preview.text, "Cash −500,00 TRY → Market");
    assert_eq!(
        post_draft(&mut b, &draft),
        vec![
            (market, "500.00".into(), "500.00".into()),
            (b.cash, "-500.00".into(), "-500.00".into()),
        ]
    );
}

#[test]
fn a_card_expense_raises_the_card_debt() {
    // Arrange
    let mut b = book();
    let market = open(&mut b.ledger, "Market", Expense, b.try_id);
    let card = open(&mut b.ledger, "Card", Liability, b.try_id);
    // Act
    let draft = draft(
        &b,
        "expense",
        json!({
            "amount": "120.50", "payment": pick(card), "date": "2026-11-02", "memo": "Migros",
            "items": [{ "expense": pick(market), "part": "120.50" }],
        }),
    );
    // Assert
    assert_eq!(
        draft.entry.as_ref().unwrap().memo.as_deref(),
        Some("Migros")
    );
    assert_eq!(
        post_draft(&mut b, &draft),
        vec![
            (market, "120.50".into(), "120.50".into()),
            (card, "-120.50".into(), "-120.50".into()),
        ]
    );
}

#[test]
fn a_split_expense_opens_a_new_expense_account_with_the_entry() {
    // Arrange
    let mut b = book();
    let market = open(&mut b.ledger, "Market", Expense, b.try_id);
    let card = open(&mut b.ledger, "Card", Liability, b.try_id);
    // Act
    let draft = draft(
        &b,
        "expense",
        json!({
            "amount": "500.00", "payment": pick(card), "date": "2026-11-02",
            "items": [
                { "expense": pick(market), "part": "300.00" },
                { "expense": { "new": "Sigara" }, "part": "100.00" },
                { "expense": { "new": " sigara " }, "part": "100.00" },
            ],
        }),
    );
    // Assert
    let entry = draft.entry.clone().unwrap();
    assert_eq!(
        entry.create_accounts.len(),
        1,
        "one new name opens one account"
    );
    let sigara = entry.create_accounts[0].id;
    assert_eq!(entry.create_accounts[0].account.kind, Expense);
    assert_eq!(
        post_draft(&mut b, &draft),
        vec![
            (market, "300.00".into(), "300.00".into()),
            (sigara, "100.00".into(), "100.00".into()),
            (sigara, "100.00".into(), "100.00".into()),
            (card, "-500.00".into(), "-500.00".into()),
        ]
    );
    assert_eq!(b.ledger.account(sigara).unwrap().name, "Sigara");
}

#[test]
fn a_new_name_that_matches_an_existing_account_uses_that_account() {
    // Arrange
    let mut b = book();
    let market = open(&mut b.ledger, "Market", Expense, b.try_id);
    // Act
    let draft = draft(
        &b,
        "expense",
        json!({
            "amount": "5.00", "payment": pick(b.cash), "date": "2026-11-02",
            "items": [{ "expense": { "new": "MARKET" }, "part": "5.00" }],
        }),
    );
    // Assert
    let entry = draft.entry.unwrap();
    assert!(entry.create_accounts.is_empty());
    assert_eq!(entry.lines[0].account, market);
}

#[test]
fn a_split_that_does_not_add_up_is_a_field_error() {
    // Arrange
    let mut b = book();
    let market = open(&mut b.ledger, "Market", Expense, b.try_id);
    // Act
    let draft = draft(
        &b,
        "expense",
        json!({
            "amount": "500.00", "payment": pick(b.cash), "date": "2026-11-02",
            "items": [{ "expense": pick(market), "part": "400.00" }],
        }),
    );
    // Assert
    assert!(draft.entry.is_none() && draft.preview.is_none());
    assert_eq!(
        errors(&draft),
        vec![(Some("items".into()), "check.split_total".into())]
    );
    assert_eq!(
        draft.errors[0].text,
        "Satırların toplamı tutara eşit olmalı."
    );
}

#[test]
fn a_dollar_card_expense_converts_the_expense_into_lira_with_the_rate() {
    // Arrange
    let mut b = book();
    let market = open(&mut b.ledger, "Market", Expense, b.try_id);
    let card = open(&mut b.ledger, "Dollar card", Liability, b.usd_id);
    // Act
    let draft = draft(
        &b,
        "expense",
        json!({
            "amount": "10.00", "payment": pick(card), "payment_rate": "35",
            "date": "2026-11-02", "items": [{ "expense": pick(market), "part": "10.00" }],
        }),
    );
    // Assert
    assert_eq!(
        draft.entry.as_ref().unwrap().lines[1].rate.as_deref(),
        Some("35")
    );
    assert_eq!(
        post_draft(&mut b, &draft),
        vec![
            (market, "350.00".into(), "350.00".into()),
            (card, "-10.00".into(), "-350.00".into()),
        ]
    );
}

#[test]
fn a_foreign_payment_without_a_rate_asks_for_the_rate() {
    // Arrange
    let mut b = book();
    let market = open(&mut b.ledger, "Market", Expense, b.try_id);
    let card = open(&mut b.ledger, "Dollar card", Liability, b.usd_id);
    // Act
    let draft = draft(
        &b,
        "expense",
        json!({
            "amount": "10.00", "payment": pick(card), "date": "2026-11-02",
            "items": [{ "expense": pick(market), "part": "10.00" }],
        }),
    );
    // Assert
    assert_eq!(
        errors(&draft),
        vec![(Some("payment_rate".into()), "rate_needed".into())]
    );
}

#[test]
fn income_split_into_salary_and_a_new_bonus_account_credits_both() {
    // Arrange
    let mut b = book();
    let bank = open(&mut b.ledger, "Bank", Asset, b.try_id);
    let salary = open(&mut b.ledger, "Maaş", Income, b.try_id);
    // Act
    let draft = draft(
        &b,
        "income",
        json!({
            "amount": "150.00", "receiving": pick(bank), "date": "2026-11-02",
            "items": [
                { "income": pick(salary), "part": "100.00" },
                { "income": { "new": "Prim" }, "part": "50.00" },
            ],
        }),
    );
    // Assert
    let bonus = draft.entry.as_ref().unwrap().create_accounts[0].id;
    assert_eq!(
        post_draft(&mut b, &draft),
        vec![
            (bank, "150.00".into(), "150.00".into()),
            (salary, "-100.00".into(), "-100.00".into()),
            (bonus, "-50.00".into(), "-50.00".into()),
        ]
    );
    assert_eq!(b.ledger.account(bonus).unwrap().kind, Income);
}

#[test]
fn an_account_of_a_kind_the_input_does_not_take_is_a_field_error() {
    // Arrange
    let mut b = book();
    let card = open(&mut b.ledger, "Card", Liability, b.try_id);
    let salary = open(&mut b.ledger, "Maaş", Income, b.try_id);
    // Act
    let draft = draft(
        &b,
        "income",
        json!({
            "amount": "10.00", "receiving": pick(card), "date": "2026-11-02",
            "items": [{ "income": pick(salary), "part": "10.00" }],
        }),
    );
    // Assert
    assert_eq!(
        errors(&draft),
        vec![(Some("receiving".into()), "account_kind".into())]
    );
}

#[test]
fn split_rows_converted_at_an_awkward_rate_still_add_up_to_the_payment() {
    // Arrange
    let mut b = book();
    let market = open(&mut b.ledger, "Market", Expense, b.try_id);
    let card = open(&mut b.ledger, "Dollar card", Liability, b.usd_id);
    let row = json!({ "expense": pick(market), "part": "0.01" });
    // Act
    let draft = draft(
        &b,
        "expense",
        json!({
            "amount": "0.03", "payment": pick(card), "payment_rate": "35.5",
            "date": "2026-11-02", "items": [row.clone(), row.clone(), row],
        }),
    );
    // Assert
    assert_eq!(
        post_draft(&mut b, &draft),
        vec![
            (market, "0.36".into(), "0.36".into()),
            (market, "0.35".into(), "0.35".into()),
            (market, "0.36".into(), "0.36".into()),
            (card, "-0.03".into(), "-1.07".into()),
        ],
        "0.01, 0.02 and 0.03 dollars are 0.36, 0.71 and 1.07 lira; each row takes its step"
    );
}

#[test]
fn a_foreign_split_of_many_rows_posts_without_a_rounding_line_at_any_rate() {
    // Arrange
    let mut b = book();
    let market = open(&mut b.ledger, "Market", Expense, b.try_id);
    let card = open(&mut b.ledger, "Dollar card", Liability, b.usd_id);
    let rounding = b.ledger.system_account("rounding").unwrap();
    for rate in ["35.5", "0.333", "1.005", "38.123456"] {
        let rows: Vec<_> = (0..10)
            .map(|_| json!({ "expense": pick(market), "part": "0.07" }))
            .collect();
        // Act
        let draft = draft(
            &b,
            "expense",
            json!({
                "amount": "0.70", "payment": pick(card), "payment_rate": rate,
                "date": "2026-11-02", "items": rows,
            }),
        );
        // Assert
        let lines = post_draft(&mut b, &draft);
        assert_eq!(lines.len(), 11, "{rate}");
        assert!(
            lines.iter().all(|(account, ..)| *account != rounding),
            "{rate}"
        );
    }
}
