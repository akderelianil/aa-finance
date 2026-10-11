import { ArrowLeftRightIcon, HandCoinsIcon, NotebookPenIcon, TrendingDownIcon, TrendingUpIcon, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { QuickKind } from '@/components/quick/QuickTransactionDialog'

export type NewEntryChoice = QuickKind | 'free'

const CHOICES: { key: NewEntryChoice; icon: LucideIcon; tone: string }[] = [
  { key: 'expense', icon: TrendingDownIcon, tone: 'text-chart-4' },
  { key: 'income', icon: TrendingUpIcon, tone: 'text-chart-2' },
  { key: 'transfer', icon: ArrowLeftRightIcon, tone: 'text-primary' },
  { key: 'debt', icon: HandCoinsIcon, tone: 'text-primary' },
]

// First step of "Yeni kayıt": say what happened in everyday words. The ledger grid (free entry) stays one click away.
export function NewEntryChooser({ open, onClose, onChoose }: {
  open: boolean; onClose: () => void; onChoose: (c: NewEntryChoice) => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('gj.chooser.title')}</DialogTitle>
          <DialogDescription>{t('gj.chooser.subtitle')}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {CHOICES.map(({ key, icon: Icon, tone }) => (
            <Button
              key={key} type="button" variant="outline" size="lg"
              className="h-auto flex-col items-start gap-2 py-4 text-start whitespace-normal"
              onClick={() => onChoose(key)}
            >
              <Icon className={`size-6 ${tone}`} />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{t(`quick.kind.${key}`)}</span>
                <span className="text-xs font-normal text-muted-foreground">{t(`gj.chooser.${key}`)}</span>
              </span>
            </Button>
          ))}
        </div>
        <Button type="button" variant="ghost" className="h-auto justify-start gap-3 py-2 whitespace-normal" onClick={() => onChoose('free')}>
          <NotebookPenIcon className="size-5 text-muted-foreground" />
          <span className="flex flex-col items-start gap-0.5 text-start">
            <span className="text-sm font-medium">{t('gj.chooser.free')}</span>
            <span className="text-xs font-normal text-muted-foreground">{t('gj.chooser.freeHint')}</span>
          </span>
        </Button>
      </DialogContent>
    </Dialog>
  )
}
