import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'

export type JournalLine = {
  id: string; account_id: string; direction: 'debit' | 'credit'; amount: number; currency: string
  base_amount: number; fx_rate: string; memo: string | null; position: number
}
export type JournalEntry = {
  id: string; entry_date: string; description: string; member_id: string; source_type: string | null
  created_at: string; journal_lines: JournalLine[]
}

export function useJournalEntries(from: string, to: string) {
  return useQuery({
    queryKey: ['ledger', 'journal', from, to],
    queryFn: async () => {
      let q = supabase.from('journal_entries')
        .select('id, entry_date, description, member_id, source_type, created_at, journal_lines(id, account_id, direction, amount, currency, base_amount, fx_rate, memo, position)')
        .is('deleted_at', null)
        .order('entry_date').order('created_at')
        .limit(2000)
      if (from) q = q.gte('entry_date', from)
      if (to) q = q.lte('entry_date', to)
      const { data, error } = await q
      if (error) throw error
      const entries = data as unknown as JournalEntry[]
      for (const e of entries) e.journal_lines.sort((a, b) => a.position - b.position)
      return entries
    },
  })
}

// Journal form draft (General Journal and Account Register).
export type DraftLine = { key: number; accountId: string; memo: string; debit: string; credit: string; rate: string; base: string }
export type Draft = { entryId?: string; date: string; description: string; lines: DraftLine[] }

let nextKey = 1
export const emptyLine = (side?: 'debit' | 'credit', amount?: string): DraftLine => ({
  key: nextKey++, accountId: '', memo: '', rate: '', base: '',
  debit: side === 'debit' ? amount ?? '' : '', credit: side === 'credit' ? amount ?? '' : '',
})
export const today = () => new Date().toLocaleDateString('sv')
export const newDraft = (): Draft => ({ date: today(), description: '', lines: [emptyLine(), emptyLine()] })

// Saved entry → form draft. A foreign line keeps its booked base amount.
export function entryToDraft(e: JournalEntry, base: string, exponents: Map<string, number>): Draft {
  const dec = (minor: number, cur: string) => {
    const x = exponents.get(cur) ?? 2
    return (minor / 10 ** x).toFixed(x)
  }
  return {
    entryId: e.id,
    date: e.entry_date,
    description: e.description,
    lines: e.journal_lines.map((l) => {
      const amount = dec(Number(l.amount), l.currency)
      return {
        ...emptyLine(), accountId: l.account_id, memo: l.memo ?? '',
        debit: l.direction === 'debit' ? amount : '', credit: l.direction === 'credit' ? amount : '',
        base: l.currency !== base ? dec(Number(l.base_amount), base) : '',
      }
    }),
  }
}

// All entries with a line on the account (register), oldest first; the running balance needs every line.
export function useAccountEntries(accountId: string | undefined) {
  return useQuery({
    queryKey: ['ledger', 'register', accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data: ids, error: e1 } = await supabase.from('journal_lines').select('entry_id').eq('account_id', accountId!)
      if (e1) throw e1
      const entryIds = [...new Set(ids.map((r) => r.entry_id as string))]
      const entries: JournalEntry[] = []
      for (let i = 0; i < entryIds.length; i += 200) {
        const { data, error } = await supabase.from('journal_entries')
          .select('id, entry_date, description, member_id, source_type, created_at, journal_lines(id, account_id, direction, amount, currency, base_amount, fx_rate, memo, position)')
          .in('id', entryIds.slice(i, i + 200))
          .is('deleted_at', null)
        if (error) throw error
        entries.push(...(data as unknown as JournalEntry[]))
      }
      for (const e of entries) e.journal_lines.sort((a, b) => a.position - b.position)
      return entries.sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.created_at.localeCompare(b.created_at))
    },
  })
}
