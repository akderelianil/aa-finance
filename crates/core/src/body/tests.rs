//! The typed revision bodies: what is written is what is read back, and nothing unknown gets in.

use super::*;
use crate::error::Error;
use crate::ids::DocId;

fn entry() -> EntryBody {
    EntryBody {
        date: "2026-10-16".into(),
        memo: Some("market".into()),
        no: None,
        status: EntryStatus::Posted,
        lines: vec![
            LineBody {
                account: DocId::new(),
                commodity: DocId::new(),
                quantity: -1250,
                base_value: -1250,
                rate: None,
            },
            LineBody {
                account: DocId::new(),
                commodity: DocId::new(),
                quantity: 1250,
                base_value: 1250,
                rate: None,
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
        parent: Some(DocId::new()),
        kind: AccountKind::Asset,
        commodity: DocId::new(),
        archived: false,
        locked: true,
        system_key: Some("rounding".into()),
    });
    let entry = Body::Entry(entry());
    let settings = Body::Settings(SettingsBody {
        base_commodity: DocId::new(),
    });
    for body in [commodity, account, entry, settings] {
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
fn a_settings_body_refuses_unknown_fields_and_a_missing_base() {
    let extra = format!(r#"{{"base_commodity":"{}","country":"TR"}}"#, DocId::new());
    assert!(matches!(
        Body::from_json(DocKind::Settings, &extra),
        Err(Error::InvalidBody(_))
    ));
    assert!(matches!(
        Body::from_json(DocKind::Settings, "{}"),
        Err(Error::InvalidBody(_))
    ));
}

#[test]
fn the_settings_document_has_one_fixed_id_in_every_book() {
    assert_eq!(
        SETTINGS_DOC.to_string(),
        "00000000-0000-7000-8000-000000000001"
    );
    assert_eq!(SETTINGS_DOC.as_uuid().get_version_num(), 7);
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
        DocId::new()
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
