//! Contacts (ADR-0024): a minimal Rehber record (name and fixed kind) that a line can point to.
//! Editing, archiving, links and the open balance come with the Rehber story.

use super::{missing, name_key, non_empty, DocRef, Ledger};
use crate::body::{Body, ContactBody, ContactKind};
use crate::error::{Error, Result, RuleCode};
use crate::ids::DocId;
use crate::ops::ContactView;
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ContactInput {
    pub name: String,
    pub kind: ContactKind,
}

impl Ledger {
    /// Adds a contact. Its name is unique in the book, ignoring case and the Turkish i.
    pub fn create_contact(&mut self, input: ContactInput) -> Result<DocRef> {
        let name = non_empty(&input.name)?;
        let wanted = name_key(&name);
        if self
            .store
            .contacts()?
            .iter()
            .any(|(_, other)| name_key(other) == wanted)
        {
            return Err(Error::Rule(RuleCode::ContactNameTaken));
        }
        let body = Body::Contact(ContactBody {
            name,
            kind: input.kind,
        });
        self.write(DocId::new(), None, body)
    }

    pub fn contact(&self, contact: DocId) -> Result<ContactView> {
        let body = self.contact_body(contact)?;
        Ok(ContactView {
            name: body.name,
            kind: body.kind,
        })
    }

    pub(super) fn contact_body(&self, id: DocId) -> Result<ContactBody> {
        match self.current_body(id, "contact")? {
            Body::Contact(body) => Ok(body),
            _ => Err(missing("contact", id)),
        }
    }
}
