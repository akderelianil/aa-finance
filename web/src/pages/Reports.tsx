import { ChartPieIcon } from 'lucide-react'
import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Membership } from '@/auth/useMembership'
import { OptionSelect } from '@/components/OptionSelect'
import { PageHeader } from '@/components/PageHeader'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { today } from '@/lib/journal'
import { formatAmount, shown, useCurrencies, useLedgerAccounts, type AccountType } from '@/lib/ledger'
import { cumulativeNet, isEmpty, periodNet, rollUp, usePeriodTotals, type ReportNode, type Totals } from '@/lib/reports'
import { cn } from '@/lib/utils'

type Tab = 'trial' | 'balance' | 'income'

// Reports in the base currency: Trial Balance (Mizan, cumulative to the end date), Balance Sheet (Bilanço, at the
// end date) and Income Statement (Gelir Tablosu, for the period).
export default function Reports({ membership }: { membership: Membership }) {
  const { t, i18n } = useTranslation()
  const base = membership.group.base_currency
  const [tab, setTab] = useState<Tab>('trial')
  const [from, setFrom] = useState(`${today().slice(0, 4)}-01-01`)
  const [to, setTo] = useState(today())
  const [depth, setDepth] = useState('9')
  const [showZero, setShowZero] = useState(false)

  const accounts = useLedgerAccounts()
  const currencies = useCurrencies()
  const totals = usePeriodTotals(from, to)
  const exp = (currencies.data ?? []).find((c) => c.code === base)?.exponent ?? 2
  const fmt = (minor: number) => formatAmount(minor, exp, i18n.language)

  const tree = useMemo(
    () => (accounts.data && totals.data ? rollUp(accounts.data.roots, totals.data) : []),
    [accounts.data, totals.data],
  )
  const ofType = (...types: AccountType[]) => tree.filter((r) => types.includes(r.node.type))
  const maxDepth = Number(depth)

  // Rows of a tree down to the chosen depth; zero rows are hidden unless asked.
  function rows(nodes: ReportNode[], render: (r: ReportNode) => ReactNode): ReactNode {
    return nodes.map((r) => {
      if ((!showZero && isEmpty(r.totals)) || r.node.depth >= maxDepth) return null
      return <Fragment key={r.node.id}>{render(r)}{rows(r.children, render)}</Fragment>
    })
  }
  const nameCell = (r: ReportNode) => (
    <td style={{ paddingLeft: `${0.75 + r.node.depth * 1.25}rem` }} className={cn(r.children.length > 0 && 'font-medium')}>
      {r.node.name}
    </td>
  )
  const num = (v: number, strong = false) => (
    <td className={cn('text-right font-mono tabular-nums', v < 0 && 'text-destructive', strong && 'font-semibold')}>{fmt(v)}</td>
  )
  const sum = (nodes: ReportNode[], f: (x: Totals) => number) => nodes.reduce((s, r) => s + f(r.totals), 0)

  const loading = accounts.isLoading || totals.isLoading

  // Balance sheet: net income to date (unclosed income − expense) goes to equity.
  const income = ofType('income')
  const expense = ofType('expense')
  const netIncomeToDate = -sum(income, cumulativeNet) - sum(expense, cumulativeNet)
  const netIncomePeriod = -sum(income, periodNet) - sum(expense, periodNet)

  function section(title: string, nodes: ReportNode[], value: (r: ReportNode) => number, extra?: ReactNode, total?: number) {
    return (
      <>
        <tr className="bg-muted/40 font-semibold [&>td]:px-3 [&>td]:py-2"><td colSpan={2}>{title}</td></tr>
        {rows(nodes, (r) => (
          <tr className="[&>td]:px-3 [&>td]:py-1">{nameCell(r)}{num(value(r), r.node.depth === 0)}</tr>
        ))}
        {extra}
        <tr className="border-t font-semibold [&>td]:px-3 [&>td]:py-2">
          <td>{t('rep.total', { name: title })}</td>
          {num(total ?? nodes.reduce((s, r) => s + value(r), 0), true)}
        </tr>
      </>
    )
  }

  return (
    <>
      <PageHeader title={t('rep.title')} description={t('rep.subtitle', { currency: base })} icon={ChartPieIcon} />
      <div className="flex items-end gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="trial">{t('rep.trial')}</TabsTrigger>
            <TabsTrigger value="balance">{t('rep.balance')}</TabsTrigger>
            <TabsTrigger value="income">{t('rep.income')}</TabsTrigger>
          </TabsList>
        </Tabs>
        {tab !== 'balance' && (
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t('gj.from')}
            <Input type="date" className="h-8 w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {tab === 'balance' ? t('rep.asOf') : t('gj.to')}
          <Input type="date" className="h-8 w-40" value={to} onChange={(e) => setTo(e.target.value || today())} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('rep.depth')}
          <OptionSelect
            className="h-8 w-32" value={depth} onChange={setDepth}
            options={[['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['9', t('rep.allLevels')]].map(([value, label]) => ({ value, label }))}
          />
        </label>
        <label className="ml-auto flex items-center gap-2 pb-2 text-sm text-muted-foreground">
          <Checkbox checked={showZero} onCheckedChange={(v) => setShowZero(v === true)} />
          {t('rep.showZero')}
        </label>
      </div>

      <div className="rounded-xl border">
        {loading && <p className="p-6 text-center text-muted-foreground">{t('ledger.loading')}</p>}

        {!loading && tab === 'trial' && (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
              <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
                <th className="text-left">{t('ledger.account')}</th>
                <th className="w-40 text-right">{t('rep.debitTotal')}</th>
                <th className="w-40 text-right">{t('rep.creditTotal')}</th>
                <th className="w-40 text-right">{t('rep.debitBalance')}</th>
                <th className="w-40 text-right">{t('rep.creditBalance')}</th>
              </tr>
            </thead>
            <tbody>
              {rows(tree, (r) => {
                const d = r.totals.beforeDebit + r.totals.debit
                const c = r.totals.beforeCredit + r.totals.credit
                const strong = r.node.depth === 0
                return (
                  <tr className={cn('[&>td]:px-3 [&>td]:py-1', strong && 'border-t bg-muted/20')}>
                    {nameCell(r)}{num(d, strong)}{num(c, strong)}{num(Math.max(d - c, 0), strong)}{num(Math.max(c - d, 0), strong)}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              {(() => {
                const d = sum(tree, (x) => x.beforeDebit + x.debit)
                const c = sum(tree, (x) => x.beforeCredit + x.credit)
                const db = tree.reduce((s, r) => s + Math.max(cumulativeNet(r.totals), 0), 0)
                const cb = tree.reduce((s, r) => s + Math.max(-cumulativeNet(r.totals), 0), 0)
                return (
                  <tr className="border-t bg-muted/40 font-semibold [&>td]:px-3 [&>td]:py-2">
                    <td>{t('rep.grandTotal')}</td>{num(d, true)}{num(c, true)}{num(db, true)}{num(cb, true)}
                  </tr>
                )
              })()}
            </tfoot>
          </table>
        )}

        {!loading && tab === 'balance' && (() => {
          const assets = ofType('asset')
          const liabilities = ofType('liability')
          const equity = ofType('equity')
          const val = (r: ReportNode) => shown(r.node.type, cumulativeNet(r.totals))
          const totalAssets = assets.reduce((s, r) => s + val(r), 0)
          const totalLiab = liabilities.reduce((s, r) => s + val(r), 0)
          const totalEquity = equity.reduce((s, r) => s + val(r), 0) + netIncomeToDate
          return (
            <div className="grid grid-cols-2 divide-x">
              <table className="w-full self-start text-sm">
                <tbody>{section(t('ledger.typePlural.asset'), assets, val)}</tbody>
              </table>
              <table className="w-full self-start text-sm">
                <tbody>
                  {section(t('ledger.typePlural.liability'), liabilities, val)}
                  {section(t('ledger.typePlural.equity'), equity, val, (
                    <tr className="[&>td]:px-3 [&>td]:py-1">
                      <td className="pl-3 font-medium">{t(netIncomeToDate >= 0 ? 'rep.netProfit' : 'rep.netLoss')}</td>
                      {num(netIncomeToDate, true)}
                    </tr>
                  ), totalEquity)}
                  <tr className="border-t-2 bg-muted/40 font-semibold [&>td]:px-3 [&>td]:py-2">
                    <td>{t('rep.totalSources')}</td>{num(totalLiab + totalEquity, true)}
                  </tr>
                </tbody>
              </table>
              <div className="col-span-2 border-t px-3 py-2 text-sm">
                {totalAssets === totalLiab + totalEquity
                  ? <span className="text-muted-foreground">{t('rep.balanced')}</span>
                  : <span className="font-medium text-destructive">{t('rep.unbalanced', { amount: fmt(totalAssets - totalLiab - totalEquity) })}</span>}
              </div>
            </div>
          )
        })()}

        {!loading && tab === 'income' && (() => {
          const val = (r: ReportNode) => shown(r.node.type, periodNet(r.totals))
          return (
            <table className="w-full text-sm">
              <tbody>
                {section(t('ledger.typePlural.income'), income, val)}
                {section(t('ledger.typePlural.expense'), expense, val)}
                <tr className="border-t-2 bg-muted/40 font-semibold [&>td]:px-3 [&>td]:py-2">
                  <td>{t(netIncomePeriod >= 0 ? 'rep.netProfit' : 'rep.netLoss')}</td>{num(netIncomePeriod, true)}
                </tr>
              </tbody>
            </table>
          )
        })()}
      </div>
    </>
  )
}
