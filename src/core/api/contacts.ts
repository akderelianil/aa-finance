import * as z from 'zod/mini'
import { fail, id, insert, name, need, read, update, write, type Ctx } from './ctx.ts'
import type { Statement } from '../db.ts'

export type ContactKind = 'individual' | 'brand' | 'business'
const kind = z.enum(['individual', 'brand', 'business'])

export type Contact = {
  id: number
  kind: ContactKind
  name: string
  /** Suggested accounts for an entry line; null for none. */
  incomeAccount: number | null
  expenseAccount: number | null
  /** A brand lists its businesses, a business its brands, a person none. */
  partners: number[]
}

export const list = read(z.object({}), async (ctx): Promise<Contact[]> => {
  const rows = await ctx.db.query(
    `SELECT c.id, c.kind, c.name, c.default_income_account_id AS income, c.default_expense_account_id AS expense,
            coalesce((SELECT json_group_array(CASE c.kind WHEN 'brand' THEN b.business_id ELSE b.brand_id END)
                      FROM brand_businesses b
                      WHERE b.deleted_at IS NULL AND (CASE c.kind WHEN 'brand' THEN b.brand_id ELSE b.business_id END) = c.id), '[]') AS partners
     FROM contacts c WHERE c.deleted_at IS NULL ORDER BY lower(c.name), c.id`)
  return rows.map((r) => ({
    id: r.id as number, kind: r.kind as ContactKind, name: r.name as string,
    incomeAccount: r.income as number | null, expenseAccount: r.expense as number | null,
    partners: (JSON.parse(r.partners as string) as number[]).sort((a, b) => a - b),
  }))
})

export type ContactBalance = { contact: number; currency: string; kind: 'receivable' | 'payable'; amount: number }

/**
 * Open debts per contact and currency, in the account currency: what a contact owes us (receivable) or we owe
 * them (payable). Sums the contact's lines on the Receivables / Payables accounts and every account below them; zero balances are left out.
 */
export const balances = read(z.object({}), async (ctx): Promise<ContactBalance[]> => {
  const rows = await ctx.db.query(
    `WITH RECURSIVE tree(id, root) AS (
       SELECT id, system_key FROM accounts WHERE system_key IN ('receivables', 'payables')
       UNION ALL
       SELECT a.id, t.root FROM accounts a JOIN tree t ON a.parent_id = t.id
     )
     SELECT l.contact_id AS contact, cur.code AS currency, (t.root = 'receivables') AS receivable, sum(l.amount) AS amount
     FROM lines l
     JOIN tree t ON t.id = l.account_id
     JOIN accounts a ON a.id = l.account_id
     JOIN currencies cur ON cur.id = a.currency_id
     WHERE l.deleted_at IS NULL AND l.contact_id IS NOT NULL
     GROUP BY l.contact_id, cur.code, receivable
     HAVING sum(l.amount) <> 0`)
  return rows.map((r) => ({
    contact: r.contact as number, currency: r.currency as string, kind: r.receivable ? 'receivable' : 'payable',
    amount: r.receivable ? (r.amount as number) : -(r.amount as number),
  }))
})

const accountRef = z.optional(z.nullable(id))
const partners = z.optional(z.array(id).check(z.maxLength(500)))

/** The partner kind a contact links to, or null for a person. */
const partnerKind = (k: ContactKind): ContactKind | null => (k === 'brand' ? 'business' : k === 'business' ? 'brand' : null)

async function checkPartners(ctx: Ctx, k: ContactKind, ids: number[]) {
  if (!ids.length) return
  const want = partnerKind(k)
  if (!want) fail('contact_link_kind')
  const found = await ctx.db.query(
    `SELECT id FROM contacts WHERE kind = ? AND deleted_at IS NULL AND id IN (SELECT value FROM json_each(?))`,
    [want, JSON.stringify(ids)])
  if (found.length !== new Set(ids).size) fail('contact_link_kind')
}

async function checkAccounts(ctx: Ctx, income: number | null | undefined, expense: number | null | undefined) {
  for (const [acc, type] of [[income, 'income'], [expense, 'expense']] as const) {
    if (acc == null) continue
    const a = await need(ctx.db, 'account_not_found', 'SELECT type, is_placeholder, archived_at FROM accounts WHERE id = ? AND deleted_at IS NULL', [acc])
    if (a.type !== type || a.is_placeholder === 1 || a.archived_at !== null) fail('contact_account_type')
  }
}

/** The link rows for one contact and its partners: a brand is always `brand_id`. */
function linkStatement(ctx: Ctx, k: ContactKind, self: number, partner: number): Statement {
  return insert(ctx, 'brand_businesses', k === 'brand' ? { brand_id: self, business_id: partner } : { brand_id: partner, business_id: self })
}

export const create = write(
  z.object({ kind, name, incomeAccount: accountRef, expenseAccount: accountRef, partners }),
  async (ctx, input) => {
    const links = [...new Set(input.partners ?? [])]
    await checkPartners(ctx, input.kind, links)
    await checkAccounts(ctx, input.incomeAccount, input.expenseAccount)
    // Ids only grow (rows are never deleted), so max + 1 is free; the single writer makes it safe.
    const [{ next }] = await ctx.db.query('SELECT coalesce(max(id), 0) + 1 AS next FROM contacts')
    const contact = next as number
    await ctx.write([
      insert(ctx, 'contacts', {
        id: contact, kind: input.kind, name: input.name,
        default_income_account_id: input.incomeAccount ?? null, default_expense_account_id: input.expenseAccount ?? null,
      }),
      ...links.map((p) => linkStatement(ctx, input.kind, contact, p)),
    ], input.name)
    return { id: contact }
  },
)

/** Kind never changes. `partners`, when given, replaces the whole set of links. */
export const edit = write(
  z.object({ id, name: z.optional(name), incomeAccount: accountRef, expenseAccount: accountRef, partners }),
  async (ctx, input) => {
    const c = await need(ctx.db, 'contact_not_found', 'SELECT kind FROM contacts WHERE id = ? AND deleted_at IS NULL', [input.id])
    const k = c.kind as ContactKind
    await checkAccounts(ctx, input.incomeAccount, input.expenseAccount)
    const set: Record<string, string | number | null> = {}
    if (input.name !== undefined) set.name = input.name
    if (input.incomeAccount !== undefined) set.default_income_account_id = input.incomeAccount
    if (input.expenseAccount !== undefined) set.default_expense_account_id = input.expenseAccount
    const statements: Statement[] = []
    if (Object.keys(set).length) statements.push(update(ctx, 'contacts', input.id, set))
    if (input.partners) {
      const want = [...new Set(input.partners)]
      await checkPartners(ctx, k, want)
      const mine = k === 'brand' ? 'brand_id' : 'business_id'
      const theirs = k === 'brand' ? 'business_id' : 'brand_id'
      const have = await ctx.db.query(`SELECT id, ${theirs} AS partner FROM brand_businesses WHERE ${mine} = ? AND deleted_at IS NULL`, [input.id])
      const now = ctx.now()
      for (const h of have)
        if (!want.includes(h.partner as number))
          statements.push({
            sql: 'UPDATE brand_businesses SET deleted_at = ?, deleted_by = ?, updated_at = ?, updated_by = ? WHERE id = ?',
            params: [now, ctx.actor, now, ctx.actor, h.id],
          })
      const kept = new Set(have.map((h) => h.partner))
      for (const p of want) if (!kept.has(p)) statements.push(linkStatement(ctx, k, input.id, p))
    }
    if (statements.length) await ctx.write(statements, String(input.id))
    return {}
  },
)

/** Soft delete; its links follow (trigger). */
export const remove = write(z.object({ id }), async (ctx, input) => {
  await need(ctx.db, 'contact_not_found', 'SELECT 1 FROM contacts WHERE id = ? AND deleted_at IS NULL', [input.id])
  await ctx.write([update(ctx, 'contacts', input.id, { deleted_at: ctx.now() })], String(input.id))
  return {}
})
