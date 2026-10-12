import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useOp } from '@/lib/api'
import { flattenTree, useAccountTree, useBook } from '@/lib/ledger'
import { JournalEditor, type Draft } from './JournalEditor'

// The free entry (journal editor) in a dialog: new when the draft has no uid, else an edit.
export function EntryDialog({ draft, onChange, onClose }: { draft: Draft | null; onChange: (d: Draft) => void; onClose: () => void }) {
  const { t } = useTranslation()
  const { base, minor, fmt } = useBook()
  const accounts = useOp('accounts.list', {})
  const { roots, byUid } = useAccountTree(accounts.data)
  const postable = useMemo(() => flattenTree(roots).filter((a) => !a.placeholder && !a.archived), [roots])
  return (
    <Dialog open={!!draft} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{draft?.uid ? t('gj.editing') : t('gj.newTitle')}</DialogTitle>
          <DialogDescription>{t('gj.newHint')}</DialogDescription>
        </DialogHeader>
        {draft && (
          <JournalEditor
            key={draft.uid ?? 'new'}
            draft={draft} onChange={onChange} accounts={postable} byUid={byUid} base={base} minor={minor} fmt={fmt}
            onCancel={onClose} onSaved={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
