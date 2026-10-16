//! The typed revision bodies: what is written is what is read back, and nothing unknown gets in.

use super::*;
use crate::error::Error;
use crate::ids::new_id;

fn entry() -> EntryBody {
    EntryBody {
        date: "2026-10-16".into(),
        memo: Some("market".into()),
        no: None,
        status: EntryStatus::Posted,
        lines: vec![
            LineBody {
                account: new_id(),
                commodity: new_id(),
                quantity: -1250,
                base_value: -1250,
            },
            LineBody {
                account: new_id(),
                commodity: new_id(),
                quantity: 1250,
                base_value: 1250,
            },
        ],
    }
}

#[test]
fn every_body_reads_back_exactly_as_written() {
    let commodity = Body::Commodity(CommodityBody {
        code: "TRY".into(),
        scale: 2,
    });
    let account = Body::Account(AccountBody {
        name: "Wallet".into(),
        parent: Some(new_id()),
        kind: AccountKind::Asset,
        commodity: new_id(),
        archived: false,
    });
    let entry = Body::Entry(entry());
    for body in [commodity, account, entry] {
        let json = body.to_json().unwrap();
        assert_eq!(Body::from_json(body.kind(), &json).unwrap(), body);
    }
}

#[test]
fn the_json_of_a_body_is_deterministic() {
    let body = Body::Entry(entry());
    assert_eq!(body.to_json().unwrap(), body.to_json().unwrap());
}

#[test]
fn a_body_with_an_unknown_field_is_refused() {
    let json = r#"{"code":"TRY","scale":2,"extra":1}"#;
    assert!(matches!(
        Body::from_json(DocKind::Commodity, json),
        Err(Error::InvalidBody(_))
    ));
}

#[test]
fn a_body_of_the_wrong_kind_is_refused() {
    let json = Body::Commodity(CommodityBody {
        code: "TRY".into(),
        scale: 2,
    })
    .to_json()
    .unwrap();
    assert!(matches!(
        Body::from_json(DocKind::Account, &json),
        Err(Error::InvalidBody(_))
    ));
}

#[test]
fn an_unknown_account_kind_is_refused() {
    let json = format!(
        r#"{{"name":"x","parent":null,"kind":"cash","commodity":"{}","archived":false}}"#,
        new_id()
    );
    assert!(Body::from_json(DocKind::Account, &json).is_err());
}

#[test]
fn a_body_knows_its_document_kind() {
    assert_eq!(Body::Entry(entry()).kind(), DocKind::Entry);
    assert_eq!(
        Body::Commodity(CommodityBody {
            code: "X".into(),
            scale: 0
        })
        .kind(),
        DocKind::Commodity
    );
}
