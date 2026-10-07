import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Membership } from '@/auth/useMembership'
import { QuickEntry } from '@/components/QuickEntry'
import type { EntryRow } from '@/components/RecentEntries'
import { ResponsiveDialog } from '@/components/ResponsiveDialog'
import type { EntryPreset } from '@/lib/entry'

type Ctx = { open: (editing?: EntryRow | null) => void; openPreset: (preset: EntryPreset) => void }
const EntryDialogContext = createContext<Ctx>({ open: () => {}, openPreset: () => {} })

// Her sayfadan açılan "yeni kayıt / kaydı düzenle" penceresi (FAB ve liste satırları kullanır).
// eslint-disable-next-line react-refresh/only-export-components
export const useEntryDialog = () => useContext(EntryDialogContext)

export function EntryDialogProvider({ membership, children }: { membership: Membership; children: ReactNode }) {
  const { t } = useTranslation()
  const [state, setState] = useState<{ editing: EntryRow | null; preset?: EntryPreset } | null>(null)
  const open = useCallback((editing?: EntryRow | null) => setState({ editing: editing ?? null }), [])
  const openPreset = useCallback((preset: EntryPreset) => setState({ editing: null, preset }), [])
  const value = useMemo(() => ({ open, openPreset }), [open, openPreset])
  const close = () => setState(null)
  const title = t(state?.editing ? 'entry.editTitle' : 'entry.title')

  return (
    <EntryDialogContext.Provider value={value}>
      {children}
      <ResponsiveDialog open={!!state} onOpenChange={(o) => { if (!o) close() }} title={title}>
        {state && <QuickEntry key={state.editing?.id ?? 'new'} membership={membership} editing={state.editing} preset={state.preset} onDone={close} />}
      </ResponsiveDialog>
    </EntryDialogContext.Provider>
  )
}
