//! Contacts (ADR-0024): a minimal Rehber record (name and fixed kind) that a line can point to.
//! Editing, archiving, links and the open balance come with the Rehber story.

use super::{missing, DocRef, Ledger, Pending};
use crate::body::{Body, ContactBody, ContactKind};
use crate::error::Result;
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
        let body = self.new_contact_body(&input, &Pending::default())?;
        self.write(DocId::new(), None, Body::Contact(body))
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
