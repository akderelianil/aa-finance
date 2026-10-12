// Dev only: create the permanent test account with three months of sample entries.
//   node scripts/dev/seed-test-account.mjs
// Needs the root .env (SUPABASE_SERVICE_ROLE_KEY) and web/.env.local (VITE_* vars). Never prints a secret.
// Creates user demo@aa-finance.test; the password goes to .env as DEV_TEST_PASSWORD (generated once).
// Resumable: if the user exists, it signs in and posts only the entries that are still missing.
// All entries go through the real Edge Functions.
import { appendFileSync, readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
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
const EMAIL = 'demo@aa-finance.test'

const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
const exists = list.users.some((u) => u.email === EMAIL)

let password = env.DEV_TEST_PASSWORD
if (!password) {
  password = randomBytes(12).toString('base64url')
  appendFileSync(root + '.env', `\n# Dev test account (scripts/dev/seed-test-account.mjs): demo@aa-finance.test\nDEV_TEST_PASSWORD=${password}\n`)
}
if (!exists) {
  const { error: ce } = await admin.auth.admin.createUser({ email: EMAIL, password, email_confirm: true })
  if (ce) throw ce
}

const user = createClient(url, web.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })
const { error: se } = await user.auth.signInWithPassword({ email: EMAIL, password })
if (se) throw se

// Retries a 5xx a few times (the pooled DB connection can hiccup).
async function call(name, body) {
  for (let attempt = 1; ; attempt++) {
    const { data, error } = await user.functions.invoke(name, { body })
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

const me = (await user.auth.getUser()).data.user
const { data: mem } = await admin.from('members').select('id, group_id').eq('user_id', me.id).maybeSingle()
const memberRow = async () => (await admin.from('members').select('id').eq('user_id', me.id).single()).data.id
const groupId = mem?.group_id ?? (await call('onboarding-create-group', {
  first_name: 'Demo', last_name: 'Kullanıcı', birth_date: '1990-01-01', base_currency: 'TRY',
  group_name: 'Demo Ailesi', chart: 'recommended',
})).group_id

// Accounts ---------------------------------------------------------------------------------------------------
const { data: rows } = await admin.from('accounts').select('id, name, type, template_key, system_key').eq('group_id', groupId)
const byKey = (k) => rows.find((a) => a.template_key === k)?.id
const wallet = rows.find((a) => a.name.startsWith('Cüzdan'))?.id
const opening = rows.find((a) => a.system_key === 'opening_balance')?.id
const findOrCreate = async (name, type, subtype) =>
  rows.find((a) => a.name === name)?.id ?? (await call('account-create', { name, type, subtype, owner_member_id: await memberRow() })).account_id
const bank = await findOrCreate('Ziraat Vadesiz', 'asset', 'bank')
const card = await findOrCreate('Garanti Bonus Kart', 'liability', 'credit_card')
const A = {
  recv: byKey('a_recv'), pay: byKey('l_pay'),
  salary: byKey('salary'), bonus: byKey('bonus'), interest: byKey('deposit_return'),
  rent: byKey('rent'), dues: byKey('dues'), subs: byKey('subscription'), internet: byKey('internet'), phone: byKey('phone'),
  electricity: byKey('electricity'), water: byKey('water'), gas: byKey('gas'), fee: byKey('bank_fee'),
  groceries: byKey('groceries'), restaurant: byKey('restaurant'), cafe: byKey('cafe'), transit: byKey('public_transport'),
  fuel: byKey('fuel'), medicine: byKey('medicine'), doctor: byKey('doctor'), clothing: byKey('clothing'),
  electronics: byKey('electronics'), events: byKey('events'), holiday: byKey('holiday'), gifts: byKey('gifts_given'),
}
for (const [k, v] of Object.entries({ ...A, bank, card, wallet, opening })) if (!v) throw new Error(`account missing: ${k}`)

// Contacts ---------------------------------------------------------------------------------------------------
const { data: people } = await admin.from('contacts').select('id, name').eq('group_id', groupId).eq('kind', 'individual')
const contactIds = {}
for (const name of ['Ahmet', 'Ayşe']) {
  contactIds[name] = people.find((c) => c.name === name)?.id ?? (await call('contact-save', { name, kind: 'individual' })).contact_id
}
const { data: brands } = await admin.from('contacts').select('id, name').eq('group_id', groupId).eq('kind', 'brand')
const brand = (n) => brands.find((b) => b.name === n)?.id

// Events -----------------------------------------------------------------------------------------------------
let seed = 20261011
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
const between = (a, b) => Math.round((a + rnd() * (b - a)) * 100) // minor units (kuruş)
const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
const money = (minor) => `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, '0')}`

const START = new Date('2026-07-12T00:00:00Z')
const END = new Date('2026-10-11T00:00:00Z')
const bal = { [bank]: 0, [wallet]: 0, [card]: 0 } // asset balances; card = amount owed
const events = []
function add(date, description, lines) {
  events.push({ date, description, lines })
  for (const l of lines) {
    if (!(l.account_id in bal)) continue
    const sign = l.account_id === card ? (l.side === 'credit' ? 1 : -1) : l.side === 'debit' ? 1 : -1
    bal[l.account_id] += sign * l.amount
  }
}
const dr = (account_id, amount, contact_id) => ({ account_id, side: 'debit', amount, contact_id })
const cr = (account_id, amount, contact_id) => ({ account_id, side: 'credit', amount, contact_id })
const spend = (date, description, expense, amount, via, contact) =>
  add(date, description, [dr(expense, amount, contact), cr(via, amount)])
// Cash first if the wallet covers it, else the card.
const cashOrCard = (amount) => (bal[wallet] >= amount ? wallet : card)

add('2026-07-12', 'Açılış bakiyesi', [dr(bank, 4500000), dr(wallet, 300000), cr(opening, 4800000)])

for (let d = new Date(START); d <= END; d.setUTCDate(d.getUTCDate() + 1)) {
  const date = d.toISOString().slice(0, 10)
  const day = d.getUTCDate()
  const dow = d.getUTCDay() // 0 = Sunday
  if (date === '2026-07-12') continue

  if (day === 15) {
    const bonus = date === '2026-09-15' ? 850000 : 0
    add(date, bonus ? 'Maaş ve prim' : 'Maaş', [dr(bank, 5200000 + bonus), cr(A.salary, 5200000), ...(bonus ? [cr(A.bonus, bonus)] : [])])
  }
  if (day === 5) {
    spend(date, 'Kira', A.rent, 1850000, bank)
    spend(date, 'Aidat', A.dues, 125000, bank)
  }
  if (day === 3) {
    spend(date, 'Netflix', A.subs, 22999, card, brand('Netflix'))
    spend(date, 'Spotify', A.subs, 5999, card, brand('Spotify'))
  }
  if (day === 10) spend(date, 'İnternet', A.internet, 44990, bank, brand('TurkNet'))
  if (day === 12) spend(date, 'Telefon', A.phone, 38900, bank, brand('Turkcell'))
  if (day === 18) spend(date, 'Elektrik', A.electricity, between(600, 950), bank, brand('Enerjisa'))
  if (day === 20) spend(date, 'Su', A.water, between(150, 260), bank, brand('İSKİ'))
  if (day === 21) spend(date, 'Doğalgaz', A.gas, between(250, 1100), bank, brand('İGDAŞ'))
  if (day === 28) {
    const interest = between(180, 260)
    add(date, 'Vadeli faiz', [dr(bank, interest), cr(A.interest, interest)])
    spend(date, 'Hesap işletim ücreti', A.fee, 1500, bank)
  }
  if (day === 1 || day === 16) {
    add(date, 'ATM para çekme', [dr(wallet, 150000), dr(A.fee, 500), cr(bank, 150500)])
  }
  if (day === 25 && date < '2026-10-01' && bal[card] > 0) {
    add(date, 'Kredi kartı ödemesi', [dr(card, bal[card]), cr(bank, bal[card])])
  }
  if (dow === 6 || dow === 3) {
    const amount = between(450, 1900)
    const store = pick(['Migros', 'BİM', 'A101', 'ŞOK'])
    spend(date, store, A.groceries, amount, rnd() < 0.6 ? card : cashOrCard(amount), brand(store))
  }
  if (dow === 0) {
    if (rnd() < 0.5) spend(date, 'Restoran', A.restaurant, between(380, 950), card)
    else spend(date, 'Kahve', A.cafe, between(90, 260), cashOrCard(26000), brand('Starbucks'))
  }
  if (dow === 1 || dow === 4) spend(date, 'İstanbulkart', A.transit, between(120, 200), cashOrCard(20000), brand('İstanbulkart'))
  if (day === 8 || day === 22) spend(date, 'Yakıt', A.fuel, between(1400, 2200), card, brand(pick(['Shell', 'Opet'])))
  if (day === 14) spend(date, 'Eczane', A.medicine, between(120, 400), cashOrCard(40000), brand('Eczane'))
}

const one = (date, description, expense, amount, via, contact) => spend(date, description, expense, amount, via, contact)
one('2026-08-09', 'Konser bileti', A.events, 78000, card, brand('Biletix'))
one('2026-08-14', 'Tatil', A.holiday, 680000, card)
one('2026-08-22', 'Doktor', A.doctor, 150000, card)
one('2026-09-06', 'Giyim', A.clothing, 245000, card, brand('LC Waikiki'))
one('2026-09-20', 'Bağış', A.gifts, 100000, bank)
one('2026-10-04', 'Kulaklık', A.electronics, 189990, card, brand('MediaMarkt'))

add('2026-07-20', 'Ahmet’ten borç alındı', [dr(bank, 500000), cr(A.pay, 500000, contactIds['Ahmet'])])
add('2026-08-03', 'Ayşe’ye borç verildi', [dr(A.recv, 200000, contactIds['Ayşe']), cr(bank, 200000)])
add('2026-09-10', 'Ahmet’e ödeme', [dr(A.pay, 200000, contactIds['Ahmet']), cr(bank, 200000)])
add('2026-09-25', 'Ayşe’den tahsilat', [dr(bank, 50000), cr(A.recv, 50000, contactIds['Ayşe'])])

// Post in date order. The card payment lines were fixed while generating, so the order only affects the register.
events.sort((a, b) => a.date.localeCompare(b.date))
const { data: done } = await admin.from('journal_entries').select('entry_date, description, journal_lines(direction, amount)')
  .eq('group_id', groupId).is('deleted_at', null)
const key = (date, description, total) => `${date}|${description}|${total}`
const posted = new Set((done ?? []).map((e) => key(e.entry_date, e.description,
  e.journal_lines.filter((l) => l.direction === 'debit').reduce((t, l) => t + Number(l.amount), 0))))
let n = 0
for (const e of events) {
  if (posted.has(key(e.date, e.description, e.lines.filter((l) => l.side === 'debit').reduce((t, l) => t + l.amount, 0)))) continue
  await call('journal-post', {
    action: 'create', date: e.date, description: e.description,
    lines: e.lines.map((l) => ({ account_id: l.account_id, side: l.side, amount: money(l.amount), ...(l.contact_id ? { contact_id: l.contact_id } : {}) })),
  }).catch((err) => {
    throw new Error(`${e.date} ${e.description} ${JSON.stringify(e.lines.map((l) => [l.side, l.amount]))}: ${err.message}`)
  })
  n++
}
console.log(`${EMAIL}, group ${groupId}: ${n} entries posted (${events.length} total), 2026-07-12 → 2026-10-11. Password: DEV_TEST_PASSWORD in .env.`)
