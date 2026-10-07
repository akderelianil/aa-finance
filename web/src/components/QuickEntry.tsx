import { ArrowDownLeftIcon, ArrowLeftRightIcon, ArrowUpRightIcon, HandCoinsIcon, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Membership } from '@/auth/useMembership'
import { DebtForm } from '@/components/entry/DebtForm'
import { DepositSettleForm } from '@/components/entry/DepositSettleForm'
import { ExpenseIncomeForm } from '@/components/entry/ExpenseIncomeForm'
import { TransferForm } from '@/components/entry/TransferForm'
import type { EntryRow } from '@/components/RecentEntries'
import type { EntryPreset } from '@/lib/entry'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

type Kind = 'expense' | 'income' | 'transfer' | 'debt'

const KINDS: { kind: Kind; icon: LucideIcon }[] = [
  { kind: 'expense', icon: ArrowUpRightIcon },
  { kind: 'income', icon: ArrowDownLeftIcon },
  { kind: 'transfer', icon: ArrowLeftRightIcon },
  { kind: 'debt', icon: HandCoinsIcon },
]

// Hızlı Kayıt: dört tür (Gider · Gelir · Transfer · Borç). ATM, döviz ve yatırım Transfer içindedir.
// Düzenlemede yalnız gider/gelir formu açılır.
export function QuickEntry({
  membership, editing, preset, onDone,
}: { membership: Membership; editing?: EntryRow | null; preset?: EntryPreset; onDone?: () => void }) {
  const { t } = useTranslation()
  const [kind, setKind] = useState<Kind>(preset && preset.kind !== 'deposit' ? preset.kind : 'expense')

  if (editing) {
    return (
      <ExpenseIncomeForm
        membership={membership} kind={editing.kind === 'income' ? 'income' : 'expense'} editing={editing} onDone={onDone}
      />
    )
  }

  // Vade sonu Yaklaşanlar'dan açılır; tür seçimi gösterilmez.
  if (preset?.kind === 'deposit') return <DepositSettleForm membership={membership} accountId={preset.accountId} onDone={onDone} />

  const props = { membership, onDone }
  return (
    <div className="flex flex-col gap-4">
      <ToggleGroup
        value={[kind]} spacing={1} className="grid w-full grid-cols-4" aria-label={t('entry.title')}
        onValueChange={(v) => { if (v[0]) setKind(v[0] as Kind) }}
      >
        {KINDS.map(({ kind: k, icon: Icon }) => (
          <ToggleGroupItem key={k} value={k} variant="outline" size="sm" className="gap-1 px-1 text-xs sm:text-sm">
            <Icon />
            {t(`entry.kind.${k}`)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {(kind === 'expense' || kind === 'income') && <ExpenseIncomeForm key={kind} kind={kind} {...props} />}
      {kind === 'transfer' && <TransferForm {...props} preset={preset?.kind === 'transfer' ? preset : undefined} />}
      {kind === 'debt' && <DebtForm {...props} preset={preset?.kind === 'debt' ? preset : undefined} />}
    </div>
  )
}
