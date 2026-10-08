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
