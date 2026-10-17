//! The named operations (ADR-0008): the only way the UI, the command line and plugins change the
//! ledger. `Ledger` stamps the author and the time, reads amounts as canonical strings, checks the
//! references first for clear errors, and writes revisions through the store, which rebuilds the
//! projection and lets the database enforce the rules.

use crate::amount::{format_amount, parse_amount, Separators};
use crate::body::{
    AccountBody, AccountKind, Body, CommodityBody, EntryBody, EntryStatus, LineBody, SettingsBody,
    SETTINGS_DOC,
};
use crate::error::{Error, Result, RuleCode};
use crate::ids::{DocId, Id, RevisionId};
use crate::rate::{resolve_line, ForeignLine, Rate};
use crate::store::{NewRevision, Store};
use serde::{Deserialize, Serialize};

mod views;

pub use views::{AccountView, EntryView, HistoryItem, LineView, SettingsView};

/// The source of "now", in milliseconds since the Unix epoch. Tests move it by hand.
pub trait Clock: Send {
    fn now_ms(&self) -> i64;
}

/// The wall clock.
pub struct SystemClock;

impl Clock for SystemClock {
    fn now_ms(&self) -> i64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_or(0, |elapsed| {
                i64::try_from(elapsed.as_millis()).unwrap_or(i64::MAX)
            })
    }
}

/// What a write returns: the document and the revision that was just written.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct DocRef {
    pub doc_id: DocId,
    pub revision_id: RevisionId,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AccountInput {
    pub name: String,
    pub parent: Option<DocId>,
    pub kind: AccountKind,
    pub commodity: DocId,
}

/// One line as the user gave it. `amount` is a canonical string in the scale of the account's
/// commodity. For a commodity other than the base, give `rate` or `base` (or both, when they agree).
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LineInput {
    pub account: DocId,
    pub amount: String,
    pub rate: Option<String>,
    pub base: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EntryInput {
    pub date: String,
    pub memo: Option<String>,
    pub no: Option<String>,
    pub lines: Vec<LineInput>,
}

/// A ledger the operations act on, as one author.
pub struct Ledger {
    store: Store,
    author: Id,
    clock: Box<dyn Clock>,
}

impl Ledger {
    pub fn new(store: Store, author: Id, clock: Box<dyn Clock>) -> Ledger {
        Ledger {
            store,
            author,
            clock,
        }
    }

    /// Opens a book: its base currency and its settings document, written together or not at all.
    /// A book is opened once; the settings are read from the file from then on.
    pub fn open_book(&mut self, base_code: &str, base_scale: u8) -> Result<DocRef> {
        if self.store.current_revision(SETTINGS_DOC)?.is_some() {
            return Err(Error::Rule(RuleCode::BookAlreadyOpen));
        }
        crate::amount::check_scale(base_scale)?;
        let base = DocId::new();
        let commodity = Body::Commodity(CommodityBody {
            code: base_code.trim().to_string(),
            scale: i64::from(base_scale),
        });
        let settings = Body::Settings(SettingsBody {
            base_commodity: base,
        });
        let revisions = vec![
            self.revision(base, None, &commodity)?,
            self.revision(SETTINGS_DOC, None, &settings)?,
        ];
        let written = self.store.write_revisions(revisions)?;
        Ok(DocRef {
            doc_id: base,
            revision_id: written[0],
        })
    }

    /// The settings of the book, read from the file.
    pub fn settings(&self) -> Result<SettingsView> {
        let Body::Settings(settings) = self.current_body(SETTINGS_DOC, "settings")? else {
            return Err(missing("settings", SETTINGS_DOC));
        };
        let base = self.commodity(settings.base_commodity)?;
        Ok(SettingsView {
            base_commodity: settings.base_commodity,
            base_code: base.code,
            base_scale: u8::try_from(base.scale)
                .map_err(|_| Error::Internal("a stored scale is out of range"))?,
        })
    }

    /// Changes the base currency. The database refuses it once the first entry exists. Every write
    /// of the book settings goes through here, which is where the admin check belongs once members
    /// and roles exist (core-rebuild-7).
    pub fn set_base_currency(&mut self, commodity: DocId) -> Result<DocRef> {
        self.commodity(commodity)?;
        self.write_next(
            SETTINGS_DOC,
            Body::Settings(SettingsBody {
                base_commodity: commodity,
            }),
        )
    }

    pub fn create_commodity(&mut self, code: &str, scale: u8) -> Result<DocRef> {
        crate::amount::check_scale(scale)?;
        let body = Body::Commodity(CommodityBody {
            code: code.trim().to_string(),
            scale: i64::from(scale),
        });
        self.write(DocId::new(), None, body)
    }

    pub fn create_account(&mut self, input: AccountInput) -> Result<DocRef> {
        self.commodity(input.commodity)?;
        if let Some(parent) = input.parent {
            self.account_body(parent)?;
        }
        let body = Body::Account(AccountBody {
            name: input.name.trim().to_string(),
            parent: input.parent,
            kind: input.kind,
            commodity: input.commodity,
            archived: false,
        });
        self.write(DocId::new(), None, body)
    }

    pub fn rename_account(&mut self, account: DocId, name: &str) -> Result<DocRef> {
        self.change_account(account, |body| body.name = name.trim().to_string())
    }

    pub fn set_account_archived(&mut self, account: DocId, archived: bool) -> Result<DocRef> {
        self.change_account(account, |body| body.archived = archived)
    }

    pub fn post_entry(&mut self, input: EntryInput) -> Result<DocRef> {
        let body = self.entry_body(input)?;
        self.write(DocId::new(), None, Body::Entry(body))
    }

    pub fn edit_entry(&mut self, entry: DocId, input: EntryInput) -> Result<DocRef> {
        self.entry_body_of(entry)?;
        let body = self.entry_body(input)?;
        self.write_next(entry, Body::Entry(body))
    }

    /// Writes the body of the previous version as a new revision. Doing it again brings the undone
    /// version back, so nothing is ever removed.
    pub fn undo(&mut self, doc: DocId) -> Result<DocRef> {
        let head = self.head_record(doc)?;
        let parent = head.parent_id.ok_or(Error::Rule(RuleCode::NothingToUndo))?;
        let previous = self.store.revision(parent)?.ok_or(Error::Internal(
            "a revision points to a parent that is not stored",
        ))?;
        let body = Body::from_json(previous.doc_kind, &previous.body)?;
        self.write_next(doc, body)
    }

    pub fn history(&self, doc: DocId) -> Result<Vec<HistoryItem>> {
        let revisions = self.store.history(doc)?;
        if revisions.is_empty() {
            return Err(missing("document", doc));
        }
        Ok(revisions.into_iter().map(HistoryItem::from).collect())
    }

    pub fn account(&self, account: DocId) -> Result<AccountView> {
        Ok(AccountView::from(self.account_body(account)?))
    }

    pub fn entry(&self, entry: DocId) -> Result<EntryView> {
        let body = self.entry_body_of(entry)?;
        let base_scale = self.settings()?.base_scale;
        let lines = body
            .lines
            .iter()
            .map(|line| {
                let scale = self.scale(line.commodity)?;
                Ok(LineView {
                    account: line.account,
                    commodity: line.commodity,
                    amount: format_amount(line.quantity, scale, Separators::CANONICAL),
                    base: format_amount(line.base_value, base_scale, Separators::CANONICAL),
                    rate: line.rate.clone(),
                })
            })
            .collect::<Result<Vec<_>>>()?;
        Ok(EntryView {
            date: body.date,
            memo: body.memo,
            no: body.no,
            lines,
        })
    }

    fn change_account(
        &mut self,
        account: DocId,
        change: impl FnOnce(&mut AccountBody),
    ) -> Result<DocRef> {
        let mut body = self.account_body(account)?;
        change(&mut body);
        self.write_next(account, Body::Account(body))
    }

    fn entry_body(&self, input: EntryInput) -> Result<EntryBody> {
        let settings = self.settings()?;
        let (base, base_scale) = (settings.base_commodity, settings.base_scale);
        let lines = input
            .lines
            .iter()
            .map(|line| self.line_body(line, base, base_scale))
            .collect::<Result<Vec<_>>>()?;
        Ok(EntryBody {
            date: input.date,
            memo: input.memo,
            no: input.no,
            status: EntryStatus::Posted,
            lines,
        })
    }

    fn line_body(&self, line: &LineInput, base: DocId, base_scale: u8) -> Result<LineBody> {
        let account = self.account_body(line.account)?;
        let scale = self.scale(account.commodity)?;
        let quantity = parse_amount(&line.amount, scale, Separators::CANONICAL)?;
        let given_base = line
            .base
            .as_deref()
            .map(|text| parse_amount(text, base_scale, Separators::CANONICAL))
            .transpose()?;
        let (base_value, rate) = if account.commodity == base {
            let rate_is_not_one = line
                .rate
                .as_deref()
                .map(Rate::parse)
                .transpose()?
                .is_some_and(|rate| rate.to_text() != "1");
            if rate_is_not_one || given_base.is_some_and(|given| given != quantity) {
                return Err(Error::Rule(RuleCode::RateBaseConflict));
            }
            (quantity, None)
        } else {
            let given_rate = line.rate.as_deref().map(Rate::parse).transpose()?;
            let resolved = resolve_line(
                &ForeignLine {
                    quantity,
                    quantity_scale: scale,
                    given_rate: given_rate.as_ref(),
                    given_base,
                    stored_rate: None,
                },
                base_scale,
            )?;
            (resolved.base_value, Some(resolved.rate.to_text()))
        };
        Ok(LineBody {
            account: line.account,
            commodity: account.commodity,
            quantity,
            base_value,
            rate,
        })
    }

    fn scale(&self, commodity: DocId) -> Result<u8> {
        u8::try_from(self.commodity(commodity)?.scale)
            .map_err(|_| Error::Internal("a stored scale is out of range"))
    }

    fn commodity(&self, id: DocId) -> Result<CommodityBody> {
        match self.current_body(id, "commodity")? {
            Body::Commodity(body) => Ok(body),
            _ => Err(missing("commodity", id)),
        }
    }

    fn account_body(&self, id: DocId) -> Result<AccountBody> {
        match self.current_body(id, "account")? {
            Body::Account(body) => Ok(body),
            _ => Err(missing("account", id)),
        }
    }

    fn entry_body_of(&self, id: DocId) -> Result<EntryBody> {
        match self.current_body(id, "entry")? {
            Body::Entry(body) => Ok(body),
            _ => Err(missing("entry", id)),
        }
    }

    fn current_body(&self, id: DocId, kind: &'static str) -> Result<Body> {
        let head = match self.store.current_revision(id)? {
            Some(_) => self.head_record(id)?,
            None => return Err(missing(kind, id)),
        };
        Body::from_json(head.doc_kind, &head.body)
    }

    fn head_record(&self, doc: DocId) -> Result<crate::RevisionRecord> {
        let head = self
            .store
            .current_revision(doc)?
            .ok_or_else(|| missing("document", doc))?;
        self.store
            .revision(head)?
            .ok_or(Error::Internal("the head revision is not stored"))
    }

    fn write_next(&mut self, doc: DocId, body: Body) -> Result<DocRef> {
        let parent = self.head_record(doc)?;
        if parent.doc_kind != body.kind() {
            return Err(Error::Rule(RuleCode::RevisionKindMismatch));
        }
        self.write(doc, Some(parent.id), body)
    }

    /// A revision stamped with the author and the time, ready for the store.
    fn revision(
        &self,
        doc_id: DocId,
        parent_id: Option<RevisionId>,
        body: &Body,
    ) -> Result<NewRevision> {
        Ok(NewRevision {
            doc_kind: body.kind(),
            doc_id,
            parent_id,
            author_id: self.author,
            created_at_ms: self.clock.now_ms(),
            body: body.to_json()?,
        })
    }

    fn write(
        &mut self,
        doc_id: DocId,
        parent_id: Option<RevisionId>,
        body: Body,
    ) -> Result<DocRef> {
        let revision = self.revision(doc_id, parent_id, &body)?;
        let revision_id = self.store.write_revision(revision)?;
        Ok(DocRef {
            doc_id,
            revision_id,
        })
    }
}

fn missing(kind: &'static str, id: DocId) -> Error {
    Error::MissingReference {
        kind,
        what: id.to_string(),
    }
}
