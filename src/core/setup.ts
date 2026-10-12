import { coreAccounts, recommendedAccounts, starterAccounts } from './chart.ts'
import type { Db, Statement } from './db.ts'
import { uuidv7 } from './uuid.ts'

export type SetupInput = {
  baseCurrency: string
  language: 'tr' | 'en'
  userName: string
  /** Also add the recommended income and expense accounts. */
  recommended: boolean
  /** ISO 3166 alpha-2. */
  country?: string | null
  /** Defaults to the user name. */
  groupName?: string
  color?: string
  /** Other members' names. */
  members?: string[]
}

/** Profile colors, given in turn. The UI maps each to a token. */
export const MEMBER_COLORS = ['blue', 'emerald', 'amber', 'rose', 'violet', 'cyan', 'orange', 'lime'] as const
export const memberColor = (i: number) => MEMBER_COLORS[i % MEMBER_COLORS.length]

/**
 * First run, in one transaction: the admin, the other members, settings and the chart template in the base currency.
 * A second run fails on the unique settings keys. Returns the user actor uid.
 */
export async function setup(db: Db, input: SetupInput): Promise<string> {
  const { user, statements } = setupStatements(input)
  await db.batch(statements)
  return user
}

/** The setup batch, so a caller can add to the same transaction. */
export function setupStatements(input: SetupInput): { user: string; statements: Statement[] } {
  const user = uuidv7()
  const actor = '(SELECT id FROM actors WHERE uid = ?)'
  const currency = '(SELECT id FROM currencies WHERE code = ?)'
  const uids = new Map<string, string>()

  const statements: Statement[] = [
    { sql: `INSERT INTO actors (uid, created_by, updated_by, kind, name, role, color) VALUES (?, 1, 1, 'user', ?, 'admin', ?)`,
      params: [user, input.userName, input.color ?? memberColor(0)] },
    ...(input.members ?? []).map((name, i) => ({
      sql: `INSERT INTO actors (uid, created_by, updated_by, kind, name, role, color) VALUES (?, ${actor}, ${actor}, 'user', ?, 'member', ?)`,
      params: [uuidv7(), user, user, name, memberColor(i + 1)],
    })),
  ]
  const setting = (key: string, value: string | null) =>
    statements.push({
      sql: `INSERT INTO settings (uid, created_by, updated_by, key, value) VALUES (?, ${actor}, ${actor}, ?, ?)`,
      params: [uuidv7(), user, user, key, value],
    })
  setting('base_currency', input.baseCurrency)
  setting('language', input.language)
  setting('lock_date', null)
  setting('activity_log_days', '365')
  setting('group_name', input.groupName ?? input.userName)
  setting('country', input.country ?? null)

  const account = (key: string, parent: string | undefined, type: string | null, name: string, placeholder: boolean, core: boolean) => {
    const uid = uuidv7()
    uids.set(key, uid)
    const parentUid = parent ? (uids.get(parent) ?? null) : null
    if (parent && !parentUid) throw new Error(`chart template: parent ${parent} comes after ${key}`)
    statements.push({
      sql: `INSERT INTO accounts (uid, created_by, updated_by, parent_id, name, type, currency_id, is_placeholder, locked, system_key)
            VALUES (?, ${actor}, ${actor}, (SELECT id FROM accounts WHERE uid = ?),
                    ?, coalesce(?, (SELECT type FROM accounts WHERE uid = ?)), ${currency}, ?, ?, ?)`,
      params: [uid, user, user, parentUid, name, type, parentUid, input.baseCurrency, placeholder ? 1 : 0, core ? 1 : 0, core ? key : null],
    })
  }
  for (const a of coreAccounts) account(a.key, a.parent, a.type, a.name, !!a.placeholder, true)
  for (const a of [...starterAccounts, ...(input.recommended ? recommendedAccounts : [])])
    account(a.key, a.parent, null, a[input.language], !!a.placeholder, false)

  return { user, statements }
}
