//! Golden drafts of Transfer and Borç (ux/transfer.md, ux/borc.md, ADR-0024): a transfer with a fee,
//! a card payment, a transfer between two currencies, and the four debt actions with a contact on
//! the debt line, a new contact and a currency child under the debt group.

use super::common::*;
use aa_core::body::AccountKind::{Asset, Liability};
use serde_json::json;

#[test]
fn an_atm_withdrawal_with_a_fee_credits_the_bank_twice_and_charges_the_fee_account() {
    // Arrange
    let mut b = book();
    let bank = open(&mut b.ledger, "Bank", Asset, b.try_id);
    let fees = b.ledger.system_account("bank_fee").unwrap();
    // Act
    let draft = draft(
        &b,
        "transfer",
        json!({
            "amount": "1000.00", "from": pick(bank), "to": pick(b.cash),
            "fee": "5.00", "date": "2026-11-02",
        }),
    );
    // Assert
    assert_eq!(
        post_draft(&mut b, &draft),
        vec![
            (bank, "-1000.00".into(), "-1000.00".into()),
            (b.cash, "1000.00".into(), "1000.00".into()),
            (bank, "-5.00".into(), "-5.00".into()),
            (fees, "5.00".into(), "5.00".into()),
        ]
    );
}

#[test]
fn a_card_payment_without_a_fee_lowers_the_card_debt() {
    // Arrange
    let mut b = book();
    let bank = open(&mut b.ledger, "Bank", Asset, b.try_id);
    let card = open(&mut b.ledger, "Card", Liability, b.try_id);
    // Act
    let draft = draft(
        &b,
        "transfer",
        json!({ "amount": "2000.00", "from": pick(bank), "to": pick(card), "date": "2026-11-02" }),
    );
    // Assert
    assert_eq!(
        draft.preview().unwrap().text,
        "Bank −2.000,00 TRY → Card +2.000,00 TRY"
    );
    assert_eq!(
        post_draft(&mut b, &draft),
        vec![
            (bank, "-2000.00".into(), "-2000.00".into()),
            (card, "2000.00".into(), "2000.00".into()),
        ]
    );
}

#[test]
fn buying_dollars_takes_both_amounts_and_values_the_dollars_at_the_lira_paid() {
    // Arrange
    let mut b = book();
    let bank = open(&mut b.ledger, "Bank", Asset, b.try_id);
    let dollars = open(&mut b.ledger, "Dollars", Asset, b.usd_id);
    // Act
    let draft = draft(
        &b,
        "transfer",
        json!({
            "amount": "3500.00", "from": pick(bank), "to": pick(dollars),
            "amount_in": "100.00", "date": "2026-11-02",
        }),
    );
    // Assert
    assert_eq!(
        post_draft(&mut b, &draft),
        vec![
            (bank, "-3500.00".into(), "-3500.00".into()),
            (dollars, "100.00".into(), "3500.00".into()),
        ]
    );
}

#[test]
fn a_transfer_between_two_currencies_needs_the_amount_in() {
    // Arrange
    let mut b = book();
    let dollars = open(&mut b.ledger, "Dollars", Asset, b.usd_id);
    // Act
    let draft = draft(
        &b,
        "transfer",
        json!({ "amount": "35.00", "from": pick(b.cash), "to": pick(dollars), "date": "2026-11-02" }),
    );
    // Assert
    assert_eq!(
        errors(&draft),
        vec![(Some("amount_in".into()), "required".into())]
    );
}

#[test]
fn a_transfer_to_the_same_account_is_refused() {
    // Arrange
    let b = book();
    // Act
    let draft = draft(
        &b,
        "transfer",
        json!({ "amount": "1.00", "from": pick(b.cash), "to": pick(b.cash), "date": "2026-11-02" }),
    );
    // Assert
    assert_eq!(
        errors(&draft),
        vec![(Some("to".into()), "same_account".into())]
    );
}

fn debt(direction: &str, person: serde_json::Value, money: DocId) -> serde_json::Value {
    json!({
        "direction": direction, "person": person, "money": pick(money),
        "amount": "2000.00", "date": "2026-11-02",
    })
}

#[test]
fn lending_to_a_new_person_opens_the_contact_and_raises_what_they_owe() {
    // Arrange
    let mut b = book();
    let receivable = b.ledger.system_account("receivable").unwrap();
    // Act
    let draft = draft(&b, "debt", debt("lend", json!({ "new": "Ayşe" }), b.cash));
    // Assert
    let entry = draft.entry().cloned().unwrap();
    assert_eq!(entry.create_contacts.len(), 1);
    let ayse = entry.create_contacts[0].id;
    assert_eq!(entry.lines[1].contact, Some(ayse));
    assert_eq!(
        draft.preview().unwrap().text,
        "Borç Verme: Ayşe, Cash 2.000,00 TRY"
    );
    assert_eq!(
        post_draft(&mut b, &draft),
        vec![
            (b.cash, "-2000.00".into(), "-2000.00".into()),
            (receivable, "2000.00".into(), "2000.00".into()),
        ]
    );
    assert_eq!(b.ledger.contact(ayse).unwrap().name, "Ayşe");
}

#[test]
fn the_four_debt_actions_move_money_and_the_debt_group_in_opposite_directions() {
    // Arrange
    let mut b = book();
    let ahmet = b
        .ledger
        .create_contact(aa_core::ops::ContactInput {
            name: "Ahmet".into(),
            kind: aa_core::body::ContactKind::Individual,
        })
        .unwrap()
        .doc_id;
    let receivable = b.ledger.system_account("receivable").unwrap();
    let payable = b.ledger.system_account("payable").unwrap();
    let cases = [
        ("lend", "-2000.00", receivable, "2000.00"),
        ("borrow", "2000.00", payable, "-2000.00"),
        ("collect", "2000.00", receivable, "-2000.00"),
        ("repay", "-2000.00", payable, "2000.00"),
    ];
    for (direction, money, group, debt_amount) in cases {
        // Act
        let draft = draft(&b, "debt", debt(direction, pick(ahmet), b.cash));
        // Assert
        assert!(draft.entry().unwrap().create_contacts.is_empty());
        let lines = post_draft(&mut b, &draft);
        assert_eq!(
            lines[0],
            (b.cash, money.into(), money.into()),
            "{direction}"
        );
        assert_eq!(
            lines[1],
            (group, debt_amount.into(), debt_amount.into()),
            "{direction}"
        );
    }
}

#[test]
fn a_dollar_loan_opens_a_dollar_account_under_the_receivable_group() {
    // Arrange
    let mut b = book();
    let dollars = open(&mut b.ledger, "Dollars", Asset, b.usd_id);
    let receivable = b.ledger.system_account("receivable").unwrap();
    let mut inputs = debt("lend", json!({ "new": "Ayşe" }), dollars);
    inputs["amount"] = json!("100.00");
    inputs["money_rate"] = json!("35");
    // Act
    let first = draft(&b, "debt", inputs.clone());
    let lines = post_draft(&mut b, &first);
    inputs["person"] = pick(first.entry().unwrap().create_contacts[0].id);
    let second = draft(&b, "debt", inputs);
    // Assert
    let child = first.entry().unwrap().create_accounts[0].clone();
    assert_eq!(child.account.name, "USD");
    assert_eq!(child.account.parent, Some(receivable));
    assert_eq!(child.account.commodity, b.usd_id);
    assert_eq!(
        lines,
        vec![
            (dollars, "-100.00".into(), "-3500.00".into()),
            (child.id, "100.00".into(), "3500.00".into()),
        ]
    );
    let second = second.entry().cloned().unwrap();
    assert!(
        second.create_accounts.is_empty(),
        "the child is found the next time"
    );
    assert_eq!(second.lines[1].account, child.id);
}
