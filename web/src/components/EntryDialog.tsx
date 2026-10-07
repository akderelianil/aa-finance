import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Membership } from '@/auth/useMembership'
import { QuickEntry } from '@/components/QuickEntry'
import type { EntryRow } from '@/components/RecentEntries'
import { ResponsiveDialog } from '@/components/ResponsiveDialog'

type Ctx = { open: (editing?: EntryRow | null) => void }
const EntryDialogContext = createContext<Ctx>({ open: () => {} })

// Her sayfadan açılan "yeni kayıt / kaydı düzenle" penceresi (FAB ve liste satırları kullanır).
// eslint-disable-next-line react-refresh/only-export-components
export const useEntryDialog = () => useContext(EntryDialogContext)

export function EntryDialogProvider({ membership, children }: { membership: Membership; children: ReactNode }) {
  const { t } = useTranslation()
  const [state, setState] = useState<{ editing: EntryRow | null } | null>(null)
  const open = useCallback((editing?: EntryRow | null) => setState({ editing: editing ?? null }), [])
  const value = useMemo(() => ({ open }), [open])
  const close = () => setState(null)
  const title = t(state?.editing ? 'entry.editTitle' : 'entry.title')

  return (
    <EntryDialogContext.Provider value={value}>
      {children}
      <ResponsiveDialog open={!!state} onOpenChange={(o) => { if (!o) close() }} title={title}>
        {state && <QuickEntry key={state.editing?.id ?? 'new'} membership={membership} editing={state.editing} onDone={close} />}
      </ResponsiveDialog>
    </EntryDialogContext.Provider>
  )
}
