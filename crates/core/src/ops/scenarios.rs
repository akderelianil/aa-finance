//! Scenarios through the operations (ADR-0024): the ledger is the books a draft reads, and the
//! built-in pack is the one the operations use.

use super::{AccountView, ContactView, Ledger};
use crate::error::{Error, Result};
use crate::ids::DocId;
use crate::scenario::builtin::builtin;
use crate::scenario::describe::{describe, list, ScenarioForm, ScenarioList};
use crate::scenario::draft::{draft, Books, Draft, DraftInput, Language};

impl Ledger {
    /// The built-in scenarios with their titles in `language`.
    pub fn scenario_list(&self, language: Language) -> Result<ScenarioList> {
        Ok(list(builtin()?, language))
    }

    /// The form of a built-in scenario, for every platform to render.
    pub fn scenario_describe(&self, scenario: &str, language: Language) -> Result<ScenarioForm> {
        describe(builtin()?, scenario, language)
    }

    /// Drafts a built-in scenario with the user's values. Nothing is written.
    pub fn scenario_draft(&self, input: DraftInput) -> Result<Draft> {
        draft(builtin()?, self, &input)
    }
}

impl Books for Ledger {
    fn base(&self) -> Result<(DocId, u8)> {
        let settings = self.settings()?;
        Ok((settings.base_commodity, settings.base_scale))
    }

    fn account(&self, id: DocId) -> Result<AccountView> {
        Ledger::account(self, id)
    }

    fn system_account(&self, key: &str) -> Result<DocId> {
        Ledger::system_account(self, key)
    }

    fn child_accounts(&self, parent: Option<DocId>) -> Result<Vec<DocId>> {
        Ok(self
            .store
            .child_accounts(parent)?
            .into_iter()
            .map(|(id, _)| id)
            .collect())
    }

    fn commodity(&self, id: DocId) -> Result<(String, u8)> {
        let body = Ledger::commodity(self, id)?;
        let scale = u8::try_from(body.scale)
            .map_err(|_| Error::Internal("a stored scale is out of range"))?;
        Ok((body.code, scale))
    }

    fn contact(&self, id: DocId) -> Result<ContactView> {
        Ledger::contact(self, id)
    }

    fn contacts(&self) -> Result<Vec<(DocId, String)>> {
        self.store.contacts()
    }
}
