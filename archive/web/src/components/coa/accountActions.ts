import type { TFunction } from 'i18next'
import type { AccountNode } from '@/lib/ledger'

export type AccountAction = {
  key: 'register' | 'addChild' | 'edit' | 'archive' | 'delete'
  label: string
  onSelect: () => void
  destructive?: boolean
}

export type AccountHandlers = {
  openRegister: (n: AccountNode) => void
  addChild: (n: AccountNode) => void
  edit: (n: AccountNode) => void
  archive: (n: AccountNode) => void
  remove: (n: AccountNode) => void
}

// One rule set for the detail panel and the right-click menu. A folded person row has no actions of its own.
export function accountActions(n: AccountNode, h: AccountHandlers, t: TFunction): AccountAction[] {
  if (n.personGroup) return []
  const out: AccountAction[] = []
  if (!n.is_placeholder) out.push({ key: 'register', label: t('coa.openRegister'), onSelect: () => h.openRegister(n) })
  if (!n.system_key) out.push({ key: 'addChild', label: t('coa.addChild'), onSelect: () => h.addChild(n) })
  if (!(n.locked && n.is_placeholder)) out.push({ key: 'edit', label: t('ledger.edit'), onSelect: () => h.edit(n) })
  if (!n.system_key && !n.locked) {
    out.push({ key: 'archive', label: n.archived_at ? t('coa.unarchive') : t('coa.archive'), onSelect: () => h.archive(n) })
    out.push({ key: 'delete', label: t('ledger.delete'), onSelect: () => h.remove(n), destructive: true })
  }
  return out
}
