//! An entry that opens its own accounts and contacts (ADR-0024): a scenario draft names them with ids
//! it chose, `post_entry` writes them with the entry in one transaction, under the same rules as
//! `create_account` and `create_contact`, and writes nothing when any part is refused.

use super::common::*;
use aa_core::body::{AccountKind, ContactKind};
use aa_core::ops::{ContactInput, NewAccount, NewContact};

fn new_account(name: &str, commodity: DocId, parent: Option<DocId>) -> NewAccount {
    let mut input = account(name, commodity);
    input.parent = parent;
    NewAccount {
        id: DocId::new(),
        account: input,
    }
}

fn new_contact(name: &str) -> NewContact {
    NewContact {
        id: DocId::new(),
        contact: ContactInput {
            name: name.to_string(),
            kind: ContactKind::Individual,
        },
    }
}

fn rule<T>(result: Result<T, Error>) -> Option<RuleCode> {
    match result {
        Err(Error::Rule(code)) => Some(code),
        _ => None,
    }
}

#[test]
fn an_entry_opens_its_account_and_its_contact_in_the_same_write() {
    // Arrange
    let mut b = book();
    let gift = new_account("Gift", b.try_id, None);
    let ahmet = new_contact("Ahmet");
    let mut paid = line(b.cash, "-50.00");
    paid.contact = Some(ahmet.id);
    let mut input = entry(vec![line(gift.id, "50.00"), paid]);
    input.create_accounts = vec![gift.clone()];
    input.create_contacts = vec![ahmet.clone()];
    // Act
    let posted = b.ledger.post_entry(input).unwrap();
    // Assert
    assert_eq!(b.ledger.account(gift.id).unwrap().name, "Gift");
    assert_eq!(b.ledger.contact(ahmet.id).unwrap().name, "Ahmet");
    let view = b.ledger.entry(posted.doc_id).unwrap();
    assert_eq!(view.lines[0].account, gift.id);
    assert_eq!(view.lines[1].contact, Some(ahmet.id));
}

#[test]
fn nothing_is_written_when_the_entry_is_refused() {
    // Arrange
    let mut b = book();
    let gift = new_account("Gift", b.try_id, None);
    let ahmet = new_contact("Ahmet");
    let mut input = entry(vec![line(gift.id, "50.00"), line(b.cash, "-40.00")]);
    input.create_accounts = vec![gift.clone()];
    input.create_contacts = vec![ahmet.clone()];
    // Act
    let result = b.ledger.post_entry(input);
    // Assert
    assert_eq!(rule(result), Some(RuleCode::EntryUnbalanced));
    assert!(matches!(
        b.ledger.account(gift.id),
        Err(Error::MissingReference { .. })
    ));
    assert!(matches!(
        b.ledger.contact(ahmet.id),
        Err(Error::MissingReference { .. })
    ));
    assert!(b.ledger.create_contact(ahmet.contact).is_ok());
}

#[test]
fn a_new_account_follows_the_rules_of_create_account() {
    // Arrange
    let mut b = book();
    let attempt = |accounts: Vec<NewAccount>, b: &mut Book| {
        let target = accounts[0].id;
        let mut input = entry(vec![line(target, "5.00"), line(b.cash, "-5.00")]);
        input.create_accounts = accounts;
        rule(b.ledger.post_entry(input))
    };
    // Act / Assert
    let taken = new_account(" cash ", b.try_id, None);
    assert_eq!(
        attempt(vec![taken], &mut b),
        Some(RuleCode::AccountNameTaken)
    );
    let twins = vec![
        new_account("Gift", b.try_id, None),
        new_account("GIFT", b.try_id, None),
    ];
    assert_eq!(attempt(twins, &mut b), Some(RuleCode::AccountNameTaken));
    let blank = new_account("  ", b.try_id, None);
    assert_eq!(attempt(vec![blank], &mut b), Some(RuleCode::NameEmpty));
    let mut income = new_account("Salary", b.try_id, Some(b.cash));
    income.account.kind = AccountKind::Income;
    assert_eq!(
        attempt(vec![income], &mut b),
        Some(RuleCode::AccountParentKindMismatch)
    );
    let ghost = new_account("Ghost", DocId::new(), None);
    let mut input = entry(vec![line(ghost.id, "5.00"), line(b.cash, "-5.00")]);
    input.create_accounts = vec![ghost];
    assert!(matches!(
        b.ledger.post_entry(input),
        Err(Error::MissingReference {
            kind: "commodity",
            ..
        })
    ));
}

#[test]
fn a_new_contact_needs_a_free_name() {
    // Arrange
    let mut b = book();
    b.ledger
        .create_contact(new_contact("Işık").contact)
        .unwrap();
    let attempt = |contacts: Vec<NewContact>, b: &mut Book| {
        let mut paid = line(b.cash, "-5.00");
        paid.contact = Some(contacts[0].id);
        let mut input = entry(vec![line(b.food, "5.00"), paid]);
        input.create_contacts = contacts;
        rule(b.ledger.post_entry(input))
    };
    // Act / Assert
    assert_eq!(
        attempt(vec![new_contact("IŞIK")], &mut b),
        Some(RuleCode::ContactNameTaken)
    );
    let twins = vec![new_contact("Ayşe"), new_contact("ayşe")];
    assert_eq!(attempt(twins, &mut b), Some(RuleCode::ContactNameTaken));
    assert_eq!(
        attempt(vec![new_contact(" ")], &mut b),
        Some(RuleCode::NameEmpty)
    );
}

#[test]
fn a_foreign_currency_account_opens_under_the_receivable_group_and_takes_a_rated_line() {
    // Arrange
    let mut b = book();
    let group = b.ledger.system_account("receivable").unwrap();
    let usd = new_account("USD", b.usd_id, Some(group));
    let mut lent = line(usd.id, "10.00");
    lent.rate = Some("35".to_string());
    let mut input = entry(vec![lent, line(b.cash, "-350.00")]);
    input.create_accounts = vec![usd.clone()];
    // Act
    let posted = b.ledger.post_entry(input).unwrap();
    // Assert
    let view = b.ledger.account(usd.id).unwrap();
    assert_eq!((view.parent, view.commodity), (Some(group), b.usd_id));
    assert!(!view.locked);
    assert_eq!(
        b.ledger.entry(posted.doc_id).unwrap().lines[0].base,
        "350.00"
    );
}

#[test]
fn a_new_document_cannot_take_an_id_that_is_already_used() {
    // Arrange
    let mut b = book();
    let mut reused = new_account("Wallet", b.try_id, None);
    reused.id = b.cash;
    let mut input = entry(vec![line(b.food, "5.00"), line(b.cash, "-5.00")]);
    input.create_accounts = vec![reused];
    // Act
    let result = b.ledger.post_entry(input);
    // Assert
    assert!(matches!(result, Err(Error::Conflict { doc_id }) if doc_id == b.cash));
    assert_eq!(b.ledger.account(b.cash).unwrap().name, "Cash");
}

#[test]
fn editing_an_entry_can_open_an_account_too() {
    // Arrange
    let mut b = book();
    let posted = b
        .ledger
        .post_entry(entry(vec![line(b.food, "5.00"), line(b.cash, "-5.00")]))
        .unwrap();
    let gift = new_account("Gift", b.try_id, None);
    let mut input = entry(vec![line(gift.id, "5.00"), line(b.cash, "-5.00")]);
    input.create_accounts = vec![gift.clone()];
    // Act
    b.ledger.edit_entry(posted.doc_id, input).unwrap();
    // Assert
    assert_eq!(
        b.ledger.entry(posted.doc_id).unwrap().lines[0].account,
        gift.id
    );
}
