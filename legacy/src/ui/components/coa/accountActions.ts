import type { TFunction } from 'i18next'
import { takesChildren } from '@/components/coa/AccountDialog'
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

// One rule set for the detail panel and the right-click menu. Locked (system) accounts never change.
export function accountActions(n: AccountNode, h: AccountHandlers, t: TFunction, canManage: boolean): AccountAction[] {
  const out: AccountAction[] = []
  if (!n.placeholder) out.push({ key: 'register', label: t('coa.openRegister'), onSelect: () => h.openRegister(n) })
  if (canManage && takesChildren(n) && !n.archived)
    out.push({ key: 'addChild', label: t('coa.addChild'), onSelect: () => h.addChild(n) })
  if (canManage && !n.locked) {
    out.push({ key: 'edit', label: t('common.edit'), onSelect: () => h.edit(n) })
    out.push({ key: 'archive', label: n.archived ? t('coa.unarchive') : t('coa.archive'), onSelect: () => h.archive(n) })
    out.push({ key: 'delete', label: t('common.delete'), onSelect: () => h.remove(n), destructive: true })
  }
  return out
}
