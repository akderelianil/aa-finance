//! Contacts through the operations (ADR-0024): a minimal contact (name and kind), unique names that
//! ignore case and the Turkish dotted and dotless i, and a line that carries a contact.

use crate::common::*;
use aa_core::body::ContactKind;
use aa_core::ops::ContactInput;

fn contact(name: &str) -> ContactInput {
    ContactInput {
        name: name.to_string(),
        kind: ContactKind::Individual,
    }
}

fn rule<T>(result: Result<T, Error>) -> Option<RuleCode> {
    match result {
        Err(Error::Rule(code)) => Some(code),
        _ => None,
    }
}

#[test]
fn a_new_contact_reads_back_with_its_trimmed_name_and_kind() {
    // Arrange
    let mut b = book();
    let input = ContactInput {
        name: "  Migros ".to_string(),
        kind: ContactKind::Brand,
    };
    // Act
    let id = b.ledger.create_contact(input).unwrap().doc_id;
    // Assert
    let view = b.ledger.contact(id).unwrap();
    assert_eq!(view.name, "Migros");
    assert_eq!(view.kind, ContactKind::Brand);
}

#[test]
fn a_contact_needs_a_name() {
    // Arrange
    let mut b = book();
    // Act
    let result = b.ledger.create_contact(contact("   "));
    // Assert
    assert_eq!(rule(result), Some(RuleCode::NameEmpty));
}

#[test]
fn two_contacts_cannot_share_a_name_ignoring_case_and_the_turkish_i() {
    // Arrange
    let mut b = book();
    for name in ["Ahmet", "Işık", "İpek"] {
        b.ledger.create_contact(contact(name)).unwrap();
    }
    // Act / Assert
    for taken in ["ahmet", " AHMET ", "IŞIK", "ışık", "ipek", "İPEK", "IPEK"] {
        assert_eq!(
            rule(b.ledger.create_contact(contact(taken))),
            Some(RuleCode::ContactNameTaken),
            "{taken}"
        );
    }
    assert!(b.ledger.create_contact(contact("Ahmet Y.")).is_ok());
}

#[test]
fn reading_a_contact_that_does_not_exist_is_a_missing_reference() {
    // Arrange
    let b = book();
    // Act
    let result = b.ledger.contact(DocId::new());
    // Assert
    assert!(matches!(
        result,
        Err(Error::MissingReference {
            kind: "contact",
            ..
        })
    ));
}

#[test]
fn a_line_carries_its_contact_into_the_entry() {
    // Arrange
    let mut b = book();
    let ahmet = b.ledger.create_contact(contact("Ahmet")).unwrap().doc_id;
    let mut debt = line(b.cash, "-50.00");
    debt.contact = Some(ahmet);
    // Act
    let entry = b
        .ledger
        .post_entry(entry(vec![line(b.food, "50.00"), debt]))
        .unwrap()
        .doc_id;
    // Assert
    let view = b.ledger.entry(entry).unwrap();
    assert_eq!(view.lines[0].contact, None);
    assert_eq!(view.lines[1].contact, Some(ahmet));
}

#[test]
fn a_line_with_an_unknown_contact_is_refused_and_nothing_is_written() {
    // Arrange
    let mut b = book();
    let mut debt = line(b.cash, "-50.00");
    debt.contact = Some(DocId::new());
    // Act
    let result = b
        .ledger
        .post_entry(entry(vec![line(b.food, "50.00"), debt]));
    // Assert
    assert!(matches!(
        result,
        Err(Error::MissingReference {
            kind: "contact",
            ..
        })
    ));
}

#[test]
fn a_line_cannot_name_an_account_as_its_contact() {
    // Arrange
    let mut b = book();
    let mut debt = line(b.cash, "-50.00");
    debt.contact = Some(b.food);
    // Act
    let result = b
        .ledger
        .post_entry(entry(vec![line(b.food, "50.00"), debt]));
    // Assert
    assert!(matches!(
        result,
        Err(Error::MissingReference {
            kind: "contact",
            ..
        })
    ));
}
