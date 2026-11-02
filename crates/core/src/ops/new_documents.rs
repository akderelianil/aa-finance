//! Accounts and contacts an entry opens in the same write (ADR-0024). A scenario draft picks their
//! ids; `post_entry` and `edit_entry` check them under the rules of `create_account` and
//! `create_contact`, read them before the store holds them, and write them with the entry in one
//! transaction, so a refused entry leaves no account or contact behind.

use super::{name_key, non_empty, AccountInput, ContactInput, DocRef, Ledger};
use crate::body::{AccountBody, Body, ContactBody};
use crate::error::{Error, Result, RuleCode};
use crate::ids::{DocId, RevisionId};
use serde::{Deserialize, Serialize};

/// An account to open with an entry, under an id the caller chose.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NewAccount {
    pub id: DocId,
    pub account: AccountInput,
}

/// A contact to open with an entry, under an id the caller chose.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NewContact {
    pub id: DocId,
    pub contact: ContactInput,
}

/// Checked accounts and contacts that are not written yet, in the order they were given.
#[derive(Debug, Default)]
pub(super) struct Pending {
    accounts: Vec<(DocId, AccountBody)>,
    contacts: Vec<(DocId, ContactBody)>,
}

impl Pending {
    fn account(&self, id: DocId) -> Option<&AccountBody> {
        self.accounts
            .iter()
            .find(|(own, _)| *own == id)
            .map(|(_, body)| body)
    }

    fn has_contact(&self, id: DocId) -> bool {
        self.contacts.iter().any(|(own, _)| *own == id)
    }

    /// The names of the pending accounts under `parent`.
    pub(super) fn child_names(&self, parent: Option<DocId>) -> impl Iterator<Item = &str> {
        self.accounts
            .iter()
            .filter(move |(_, body)| body.parent == parent)
            .map(|(_, body)| body.name.as_str())
    }
}

impl Ledger {
    /// Checks the accounts and contacts an entry opens; each may build on the ones before it.
    pub(super) fn pending(
        &self,
        accounts: &[NewAccount],
        contacts: &[NewContact],
    ) -> Result<Pending> {
        let mut pending = Pending::default();
        for new in accounts {
            let body = self.new_account_body(&new.account, &pending)?;
            pending.accounts.push((new.id, body));
        }
        for new in contacts {
            let body = self.new_contact_body(&new.contact, &pending)?;
            pending.contacts.push((new.id, body));
        }
        Ok(pending)
    }

    /// The body of a new account, checked against the store and the pending accounts.
    pub(super) fn new_account_body(
        &self,
        input: &AccountInput,
        pending: &Pending,
    ) -> Result<AccountBody> {
        self.commodity(input.commodity)?;
        let name = non_empty(&input.name)?;
        if let Some(parent) = input.parent {
            let parent = self.account_in(parent, pending)?;
            if parent.archived {
                return Err(Error::Rule(RuleCode::AccountParentArchived));
            }
            if parent.kind != input.kind {
                return Err(Error::Rule(RuleCode::AccountParentKindMismatch));
            }
        }
        self.check_name_free(input.parent, &name, None, pending)?;
        Ok(AccountBody {
            name,
            parent: input.parent,
            kind: input.kind,
            commodity: input.commodity,
            archived: false,
            locked: false,
            system_key: None,
        })
    }

    /// The body of a new contact; its name is unique in the book and among the pending contacts.
    pub(super) fn new_contact_body(
        &self,
        input: &ContactInput,
        pending: &Pending,
    ) -> Result<ContactBody> {
        let name = non_empty(&input.name)?;
        let wanted = name_key(&name);
        let stored = self.store.contacts()?;
        let taken = stored
            .iter()
            .map(|(_, other)| other.as_str())
            .chain(pending.contacts.iter().map(|(_, body)| body.name.as_str()))
            .any(|other| name_key(other) == wanted);
        if taken {
            return Err(Error::Rule(RuleCode::ContactNameTaken));
        }
        Ok(ContactBody {
            name,
            kind: input.kind,
        })
    }

    /// An account that is pending or stored.
    pub(super) fn account_in(&self, id: DocId, pending: &Pending) -> Result<AccountBody> {
        match pending.account(id) {
            Some(body) => Ok(body.clone()),
            None => self.account_body(id),
        }
    }

    /// The id of a contact that is pending or stored.
    pub(super) fn contact_in(&self, id: DocId, pending: &Pending) -> Result<DocId> {
        if !pending.has_contact(id) {
            self.contact_body(id)?;
        }
        Ok(id)
    }

    /// Writes the pending documents and then the entry, all or nothing.
    pub(super) fn write_with(
        &mut self,
        pending: Pending,
        doc_id: DocId,
        parent_id: Option<RevisionId>,
        body: Body,
    ) -> Result<DocRef> {
        let accounts = pending
            .accounts
            .into_iter()
            .map(|(id, b)| (id, Body::Account(b)));
        let contacts = pending
            .contacts
            .into_iter()
            .map(|(id, b)| (id, Body::Contact(b)));
        let mut revisions = accounts
            .chain(contacts)
            .map(|(id, body)| self.revision(id, None, &body))
            .collect::<Result<Vec<_>>>()?;
        revisions.push(self.revision(doc_id, parent_id, &body)?);
        let written = self.store.write_revisions(revisions)?;
        let revision_id = *written
            .last()
            .ok_or(Error::Internal("a write returned no revision"))?;
        Ok(DocRef {
            doc_id,
            revision_id,
        })
    }
}
