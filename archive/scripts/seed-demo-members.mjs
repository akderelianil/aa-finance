// Dev only: add two family members to the demo group, each with three months of own entries.
//   node scripts/dev/seed-demo-members.mjs        (run seed-test-account.mjs first)
// Members: Elif (spouse, salary, bank + card) and Can (student, allowance, cash). Same password as the demo
// admin (DEV_TEST_PASSWORD in .env). Resumable: it posts only the entries that are still missing. Never prints a secret.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const { createClient } = createRequire(root + 'web/package.json')('@supabase/supabase-js')

function loadEnv(file) {
  const out = {}
  for (const line of readFileSync(root + file, 'utf8').split('\n')) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}
const env = loadEnv('.env')
const web = loadEnv('web/.env.local')
const url = web.VITE_SUPABASE_URL
const password = env.DEV_TEST_PASSWORD
if (!password) throw new Error('DEV_TEST_PASSWORD missing: run seed-test-account.mjs first')

const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const newClient = () => createClient(url, web.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })

async function signIn(email) {
  const c = newClient()
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw error
  return c
}

// Retries a 5xx a few times (the pooled DB connection can hiccup).
async function call(client, name, body) {
  for (let attempt = 1; ; attempt++) {
    const { data, error } = await client.functions.invoke(name, { body })
    if (!error) return data
    const res = error.context
    const p = res && (await res.json().catch(() => null))
    if (res?.status >= 500 && attempt < 4) {
      await new Promise((r) => setTimeout(r, 1500 * attempt))
      continue
    }
    throw new Error(`${name}: ${p?.error ?? error.message} ${p?.message ?? ''}`)
  }
}

const money = (minor) => `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, '0')}`

// Demo group and invite -----------------------------------------------------------------------------------------
const ADMIN_EMAIL = 'demo@aa-finance.test'
const adminClient = await signIn(ADMIN_EMAIL)
const adminUser = (await adminClient.auth.getUser()).data.user
const { data: adminMember } = await admin.from('members').select('group_id').eq('user_id', adminUser.id).single()
const groupId = adminMember.group_id
let inviteCode

// Members -------------------------------------------------------------------------------------------------------
const START = new Date('2026-07-12T00:00:00Z')
const END = new Date('2026-10-11T00:00:00Z')

const { data: groupAccounts } = await admin.from('accounts').select('id, name, template_key').eq('group_id', groupId)
const key = (k) => {
  const id = groupAccounts.find((a) => a.template_key === k)?.id
  if (!id) throw new Error(`account missing: ${k}`)
  return id
}
const { data: brands } = await admin.from('contacts').select('id, name').eq('group_id', groupId).eq('kind', 'brand')
const brand = (n) => brands.find((b) => b.name === n)?.id

async function seedMember({ email, first, last, birth, seed, build }) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (!list.users.some((u) => u.email === email)) {
    const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (error) throw error
  }
  const me = await signIn(email)
  const uid = (await me.auth.getUser()).data.user.id
  let { data: mem } = await admin.from('members').select('id').eq('user_id', uid).maybeSingle()
  if (!mem) {
    inviteCode ??= (await call(adminClient, 'invite-create', {})).code
    await call(me, 'onboarding-join-group', { code: inviteCode, first_name: first, last_name: last, birth_date: birth })
    ;({ data: mem } = await admin.from('members').select('id').eq('user_id', uid).single())
  }

  // Own accounts (owner label = this member).
  const { data: own } = await admin.from('accounts').select('id, name, system_key').eq('group_id', groupId).eq('owner_member_id', mem.id)
  const opening = own.find((a) => a.system_key === 'opening_balance')?.id
  const wallet = own.find((a) => a.name.startsWith('Cüzdan'))?.id
  const mk = async (name, type, subtype) =>
    own.find((a) => a.name === name)?.id ?? (await call(me, 'account-create', { name, type, subtype, owner_member_id: mem.id })).account_id

  let s = seed
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296)
  const between = (a, b) => Math.round((a + rnd() * (b - a)) * 100)
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)]

  const events = []
  const bal = {}
  const add = (date, description, lines, contact) => {
    events.push({ date, description, lines: lines.map((l) => ({ ...l, contact_id: l.contact_id ?? contact })) })
    for (const l of lines) bal[l.account_id] = (bal[l.account_id] ?? 0) + (l.side === 'debit' ? 1 : -1) * l.amount
  }
  const dr = (account_id, amount) => ({ account_id, side: 'debit', amount })
  const cr = (account_id, amount) => ({ account_id, side: 'credit', amount })
  const spend = (date, description, expense, amount, via, contact) => add(date, description, [dr(expense, amount), cr(via, amount)], contact)

  await build({ mk, opening, wallet, key, brand, between, pick, rnd, add, dr, cr, spend, bal, START, END })

  // Post missing entries in date order.
  events.sort((a, b) => a.date.localeCompare(b.date))
  const { data: done } = await admin.from('journal_entries').select('entry_date, description, journal_lines(direction, amount)')
    .eq('group_id', groupId).eq('member_id', mem.id).is('deleted_at', null)
  const k = (date, d, total) => `${date}|${d}|${total}`
  const posted = new Set((done ?? []).map((e) => k(e.entry_date, e.description,
    e.journal_lines.filter((l) => l.direction === 'debit').reduce((t, l) => t + Number(l.amount), 0))))
  let n = 0
  for (const e of events) {
    if (posted.has(k(e.date, e.description, e.lines.filter((l) => l.side === 'debit').reduce((t, l) => t + l.amount, 0)))) continue
    await call(me, 'journal-post', {
      action: 'create', date: e.date, description: e.description,
      lines: e.lines.map((l) => ({ account_id: l.account_id, side: l.side, amount: money(l.amount), ...(l.contact_id ? { contact_id: l.contact_id } : {}) })),
    }).catch((err) => {
      throw new Error(`${email} ${e.date} ${e.description}: ${err.message}`)
    })
    n++
  }
  console.log(`${email}: ${n} entries posted (${events.length} total).`)
}

// Elif: salary on the 28th, own bank and card. -----------------------------------------------------------------
await seedMember({
  email: 'demo.elif@aa-finance.test', first: 'Elif', last: 'Kullanıcı', birth: '1992-05-20', seed: 41000017,
  build: async (c) => {
    const bank = await c.mk('Elif - Akbank Vadesiz', 'asset', 'bank')
    const card = await c.mk('Elif - Yapı Kredi Kart', 'liability', 'credit_card')
    c.add('2026-07-12', 'Açılış bakiyesi', [c.dr(bank, 1800000), c.dr(c.wallet, 100000), c.cr(c.opening, 1900000)])
    const cash = () => c.bal[c.wallet] ?? 0
    for (let d = new Date(c.START); d <= c.END; d.setUTCDate(d.getUTCDate() + 1)) {
      const date = d.toISOString().slice(0, 10)
      const day = d.getUTCDate()
      const dow = d.getUTCDay()
      if (date === '2026-07-12') continue
      if (day === 28) c.add(date, 'Maaş', [c.dr(bank, 4100000), c.cr(c.key('salary'), 4100000)])
      if (day === 2) c.spend(date, 'Spor salonu', c.key('sports'), 110000, card, c.brand('MAC'))
      if (day === 22 && date < '2026-10-01' && (c.bal[card] ?? 0) < 0) {
        const owed = -c.bal[card]
        c.add(date, 'Kredi kartı ödemesi', [c.dr(card, owed), c.cr(bank, owed)])
      }
      if (dow === 2) c.spend(date, 'Migros', c.key('groceries'), c.between(300, 900), card, c.brand('Migros'))
      if (dow === 5) c.spend(date, 'Restoran', c.key('restaurant'), c.between(300, 900), card)
      if (day === 9 || day === 24) {
        const shop = c.pick(['Watsons', 'Gratis'])
        c.spend(date, shop, c.key('cosmetics'), c.between(200, 700), card, c.brand(shop))
      }
      if (day === 14 && date >= '2026-08-01') c.spend(date, 'Kuaför', c.key('hairdresser'), c.between(500, 800), cash() >= 80000 ? c.wallet : card)
      if (day === 18) {
        const shop = c.pick(['Zara', 'Mavi'])
        c.spend(date, shop, c.key('clothing'), c.between(1200, 2800), card, c.brand(shop))
      }
      if (dow === 6 && day < 8) c.spend(date, 'BiTaksi', c.key('taxi'), c.between(150, 350), cash() >= 35000 ? c.wallet : card, c.brand('BiTaksi'))
    }
    c.spend('2026-09-03', 'Kitap', c.key('stationery'), 35000, card, c.brand('D&R'))
  },
})

// Can: allowance on the 1st, cash only. ------------------------------------------------------------------------
await seedMember({
  email: 'demo.can@aa-finance.test', first: 'Can', last: 'Kullanıcı', birth: '2008-02-14', seed: 20080214,
  build: async (c) => {
    c.add('2026-07-12', 'Açılış bakiyesi', [c.dr(c.wallet, 80000), c.cr(c.opening, 80000)])
    const cash = () => c.bal[c.wallet] ?? 0
    for (let d = new Date(c.START); d <= c.END; d.setUTCDate(d.getUTCDate() + 1)) {
      const date = d.toISOString().slice(0, 10)
      const day = d.getUTCDate()
      const dow = d.getUTCDay()
      if (date === '2026-07-12') continue
      if (day === 1 || date === '2026-07-15') c.add(date, 'Harçlık', [c.dr(c.wallet, 300000), c.cr(c.key('allowance'), 300000)])
      const tryPay = (description, account, amount, contact) => {
        if (cash() >= amount) c.spend(date, description, account, amount, c.wallet, contact)
      }
      if (dow === 1 || dow === 3 || dow === 5) tryPay('İstanbulkart', c.key('public_transport'), c.between(40, 80), c.brand('İstanbulkart'))
      if (dow === 2 || dow === 6) tryPay('Starbucks', c.key('cafe'), c.between(90, 220), c.brand('Starbucks'))
      if (day === 20) tryPay('Etkinlik', c.key('events'), 35000, c.brand(c.pick(['Biletix', 'Passo'])))
      if (date === '2026-09-08') tryPay('Kırtasiye', c.key('stationery'), 42000, c.brand('Kitapyurdu'))
      if (date === '2026-09-12') tryPay('Giyim', c.key('clothing'), 110000, c.brand('LC Waikiki'))
    }
  },
})
