import { ArrowDownLeftIcon, ArrowLeftRightIcon, ArrowUpRightIcon, BanknoteIcon, HandCoinsIcon, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { Membership } from '@/auth/useMembership'
import { AtmForm } from '@/components/entry/AtmForm'
import { DebtForm } from '@/components/entry/DebtForm'
import { ExpenseIncomeForm } from '@/components/entry/ExpenseIncomeForm'
import { TransferForm } from '@/components/entry/TransferForm'
import type { EntryRow } from '@/components/RecentEntries'
import { Button } from '@/components/ui/button'
import type { EntryPreset } from '@/lib/entry'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

type Kind = 'expense' | 'income' | 'transfer' | 'debt' | 'atm'

const KINDS: { kind: Kind; icon: LucideIcon }[] = [
  { kind: 'expense', icon: ArrowUpRightIcon },
  { kind: 'income', icon: ArrowDownLeftIcon },
  { kind: 'transfer', icon: ArrowLeftRightIcon },
  { kind: 'debt', icon: HandCoinsIcon },
  { kind: 'atm', icon: BanknoteIcon },
]

// Hızlı Kayıt: "Ne oldu?" → beş düğme + küçük "Diğer" (döviz, yatırım). Düzenlemede yalnız gider/gelir formu açılır.
export function QuickEntry({
  membership, editing, preset, onDone,
}: { membership: Membership; editing?: EntryRow | null; preset?: EntryPreset; onDone?: () => void }) {
  const { t } = useTranslation()
  const [kind, setKind] = useState<Kind>(preset?.kind ?? 'expense')

  if (editing) {
    return (
      <ExpenseIncomeForm
        membership={membership} kind={editing.kind === 'income' ? 'income' : 'expense'} editing={editing} onDone={onDone}
      />
    )
  }

  const props = { membership, onDone }
  return (
    <div className="flex flex-col gap-4">
      <ToggleGroup
        value={[kind]} spacing={1} className="grid w-full grid-cols-5" aria-label={t('entry.title')}
        onValueChange={(v) => { if (v[0]) setKind(v[0] as Kind) }}
      >
        {KINDS.map(({ kind: k, icon: Icon }) => (
          <ToggleGroupItem key={k} value={k} variant="outline" className="h-auto flex-col gap-1 px-1 py-2 text-xs">
            <Icon />
            {t(`entry.kind.${k}`)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {(kind === 'expense' || kind === 'income') && <ExpenseIncomeForm key={kind} kind={kind} {...props} />}
      {kind === 'transfer' && <TransferForm {...props} preset={preset?.kind === 'transfer' ? preset : undefined} />}
      {kind === 'debt' && <DebtForm {...props} preset={preset?.kind === 'debt' ? preset : undefined} />}
      {kind === 'atm' && <AtmForm {...props} />}
      <div className="flex flex-wrap items-center justify-center gap-1 text-xs text-muted-foreground">
        <span>{t('entry.other')}:</span>
        <Button variant="link" size="xs" nativeButton={false} render={<Link to="/hesaplar" />} onClick={onDone}>{t('entry.otherFx')}</Button>
        <Button variant="link" size="xs" nativeButton={false} render={<Link to="/ayarlar/yatirimlar" />} onClick={onDone}>{t('entry.otherInvest')}</Button>
      </div>
    </div>
  )
}
