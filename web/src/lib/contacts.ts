import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'

// Rehber: the group's contacts (individual, brand, business). Archived contacts stay in the list so past
// journal lines still show their name; pickers offer only active ones.
export type ContactKind = 'individual' | 'brand' | 'business'
export type ContactBank = { bank_name: string | null; iban: string }
export type Contact = {
  id: string
  name: string
  kind: ContactKind
  phone: string | null
  email: string | null
  default_income_account_id: string | null
  default_expense_account_id: string | null
  archived_at: string | null
  banks: ContactBank[]
}

export function useContacts() {
  return useQuery({
    queryKey: ['directory', 'contacts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, kind, phone, email, default_income_account_id, default_expense_account_id, archived_at, banks:contact_bank_accounts(bank_name, iban)')
        .order('name')
        .overrideTypes<Contact[]>()
      if (error) throw error
      return data
    },
  })
}

/** Contact names of an entry's lines, in line order, without repeats. */
export function lineContacts(lines: { contact_id: string | null }[], byId: Map<string, Contact>): string[] {
  return [...new Set(lines.flatMap((l) => (l.contact_id ? [l.contact_id] : [])))]
    .map((id) => byId.get(id)?.name ?? '—')
}
