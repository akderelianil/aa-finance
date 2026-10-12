// Dev only: a family book (Ahmet admin, Ayşe, Fatma, Dursun) with three months of entries, Jul–Sep 2026.
// Covers every entry flow (Gider, Gelir, Transfer, Borç, Serbest kayıt), foreign currencies, splits, fees,
// edits, deletes and an admin fix of a member's entry.
// Run: node scripts/dev/seed-local.ts [file]   (default .dev/aa-finance.sqlite; stop `vite` first, it holds the file)
import { mkdirSync, rmSync } from 'node:fs'
import { dirname } from 'node:path'
import { createApi } from '../../src/core/api/index.ts'
import type { EntryInput } from '../../src/core/api/entries.ts'
import { migrate } from '../../src/core/migrate.ts'
import { toBase } from '../../src/core/money.ts'
import * as quick from '../../src/core/quick.ts'
import { openNodeDb, readMigrations } from '../../src/core/test/node-db.ts'

const path = process.argv[2] ?? '.dev/aa-finance.sqlite'
mkdirSync(dirname(path), { recursive: true })
for (const f of [path, `${path}-wal`, `${path}-shm`]) rmSync(f, { force: true })
const db = openNodeDb(path)
await migrate(db, readMigrations())
const api = createApi(db)

// ---------- setup, members ----------
await api.call('setup.run', {
  baseCurrency: 'TRY', language: 'tr', userName: 'Ahmet', recommended: true, country: 'TR',
  groupName: 'Akdereli Ailesi', members: ['Ayşe', 'Fatma', 'Dursun'],
})
const memberId: Record<string, number> = {}
for (const m of await api.call('members.list', {})) memberId[m.name] = m.id
const as = (who: string) => api.use(memberId[who])
as('Ahmet')

const currencies = await api.call('currencies.list', {})
const book: quick.Book = { base: 'TRY', minor: (c) => currencies.find((x) => x.code === c)!.minorUnit }

// ---------- accounts ----------
type Acc = Awaited<ReturnType<typeof listAccounts>>[number]
const listAccounts = () => api.call('accounts.list', {})
let cache: Acc[] = await listAccounts()
const refresh = async () => (cache = await listAccounts())
const sysId = (key: string) => cache.find((a) => a.systemKey === key)!.id
const byName = (name: string) => cache.find((a) => a.name === name && !a.archived) ?? (() => { throw new Error(`account ${name}`) })()
const qa = (name: string): quick.QuickAccount => {
  const a = byName(name)
  return { id: a.id, type: a.type, currency: a.currency }
}
const add = async (parent: string, name: string, currency?: string) => {
  const id = (await api.call('accounts.create', { parent: sysId(parent), name, currency })).id
  await refresh()
  return id
}
const addUnder = async (parentName: string, name: string, currency?: string) => {
  const id = (await api.call('accounts.create', { parent: byName(parentName).id, name, currency })).id
  await refresh()
  return id
}

await add('bank', 'Ziraat Vadesiz')
await add('bank', 'Garanti Vadesiz')
await add('bank', 'Dolar Hesabı', 'USD')
await add('bank', 'Euro Hesabı', 'EUR')
await add('bank', 'Eski Banka')
await add('cash', 'Ayşe Cüzdan')
await add('cash', 'Fatma Cüzdan')
await add('cash', 'Dursun Cüzdan')
await add('investments', 'Hisse Portföyü')
await add('fixed_assets', 'Araba')
await add('fixed_assets', 'Birikmiş Amortisman')
await add('credit_cards', 'Bonus Kart')
await add('credit_cards', 'World Kart')
await add('loans', 'Taşıt Kredisi')
await add('expense', 'Amortisman Gideri')
await add('expense', 'Yurtdışı Tatil', 'EUR')
await add('income', 'Yatırım Değer Artışı')
await add('income', 'Dolar Faiz Geliri', 'USD')
await add('income', 'Serbest Meslek Geliri (USD)', 'USD')
const trash = await add('expense', 'Deneme Hesabı')

// Renaming the starter wallet makes the four wallets read alike.
await api.call('accounts.update', { id: byName('Cüzdan').id, name: 'Ahmet Cüzdan' })
await refresh()

// ---------- Rehber ----------
const contact: Record<string, number> = {}
const mk = async (name: string, kind: 'individual' | 'brand' | 'business', extra: { expense?: string; income?: string; partners?: string[] } = {}) => {
  contact[name] = (await api.call('contacts.create', {
    kind, name,
    expenseAccount: extra.expense ? byName(extra.expense).id : undefined,
    incomeAccount: extra.income ? byName(extra.income).id : undefined,
    partners: extra.partners?.map((p) => contact[p]),
  })).id
}
await mk('Ali Yılmaz', 'individual')
await mk('Zeynep Kaya', 'individual')
await mk('Mehmet Demir', 'individual')
await mk('Hasan Usta', 'individual', { expense: 'Araç Bakım & Servis' })
await mk('Migros Ataşehir', 'business', { expense: 'Market' })
await mk('Shell Kadıköy', 'business', { expense: 'Yakıt' })
await mk('Migros', 'brand', { expense: 'Market', partners: ['Migros Ataşehir'] })
await mk('Shell', 'brand', { expense: 'Yakıt', partners: ['Shell Kadıköy'] })
await mk('Netflix', 'brand', { expense: 'Dijital Abonelik' })
await mk('Apartman Yönetimi', 'business', { expense: 'Aidat' })

// ---------- FX rates (every Monday, plus 07-01) ----------
const day = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const START = Date.UTC(2026, 6, 1)
const DAYS = 92
const dateOf = (i: number) => new Date(START + i * 864e5).toISOString().slice(0, 10)
let seed = 42
const rnd = () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const between = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1))
const pick = <T>(xs: T[]) => xs[Math.floor(rnd() * xs.length)]
const tl = (n: number) => Math.round(n * 100)

const rates: Record<string, { date: string; rate: string }[]> = { USD: [], EUR: [] }
for (let i = 0; i < DAYS; i++) {
  const d = new Date(START + i * 864e5)
  if (i !== 0 && d.getUTCDay() !== 1) continue
  for (const [cur, from, to] of [['USD', 40.25, 42.0], ['EUR', 47.1, 48.7]] as const) {
    const v = from + ((to - from) * i) / DAYS + (rnd() - 0.5) * 0.12
    const r = { date: dateOf(i), rate: v.toFixed(2) }
    rates[cur].push(r)
    await api.call('fx.set', { currency: cur, date: r.date, rate: r.rate })
  }
}
const rateAt = (cur: string, on: string) => [...rates[cur]].reverse().find((r) => r.date <= on)!.rate

// ---------- event plan: collected, then run in date order ----------
type Event = { date: string; who: string; seq: number; tag?: string; run: () => Promise<unknown> }
const events: Event[] = []
const posted: Record<string, { id: number; who: string; date: string }> = {}
const post = (who: string, date: string, build: () => EntryInput | Promise<EntryInput>, tag?: string) =>
  events.push({
    date, who, tag, seq: events.length,
    run: async () => {
      const r = await api.call('entries.post', await build())
      if (tag) posted[tag] = { id: r.id, who, date }
    },
  })

const bal = async (name: string, on: string) => (await api.call('accounts.list', { asOf: on })).find((a) => a.id === byName(name).id)!.balance

type Split = [account: string, amount: number, memo?: string, money?: string]
const gider = (who: string, date: string, from: string, splits: Split[], description: string, o: { rate?: string; ref?: string; tag?: string } = {}) =>
  post(who, date, () => quick.expense(book, {
    date, description, reference: o.ref, from: qa(from), total: splits.reduce((s, x) => s + x[1], 0), rate: o.rate,
    splits: splits.map(([a, amount, memo, money]) => ({ account: qa(a), amount, memo, money: money ? qa(money) : undefined })),
  }), o.tag)
const gelir = (who: string, date: string, to: string, splits: Split[], description: string, o: { rate?: string; ref?: string; tag?: string } = {}) =>
  post(who, date, () => quick.income(book, {
    date, description, reference: o.ref, to: qa(to), total: splits.reduce((s, x) => s + x[1], 0), rate: o.rate,
    splits: splits.map(([a, amount, memo]) => ({ account: qa(a), amount, memo })),
  }), o.tag)
const transfer = (who: string, date: string, from: string, to: string, amount: number, description: string,
  o: { toAmount?: number; fee?: number; rate?: string; tag?: string } = {}) =>
  post(who, date, () => quick.transfer(book, {
    date, description, from: qa(from), to: qa(to), amount, toAmount: o.toAmount, fee: o.fee,
    feeAccount: o.fee ? qa('Bank Fees') : undefined, rate: o.rate,
  }), o.tag)
const debtAccount = async (kind: quick.DebtKind, cur: string): Promise<quick.QuickAccount> => {
  const group = cache.find((a) => a.systemKey === (kind === 'lend' || kind === 'collect' ? 'receivables' : 'payables'))!
  const found = cache.find((a) => a.parent === group.id && a.currency === cur && !a.archived)
  if (found) return { id: found.id, type: found.type, currency: found.currency }
  const id = (await api.call('accounts.create', { parent: group.id, name: cur, currency: cur })).id
  await refresh()
  return { id, type: group.type, currency: cur }
}
const borc = (who: string, date: string, kind: quick.DebtKind, person: string, money: string, amount: number, description: string, tag?: string) =>
  post(who, date, async () => quick.debt(book, {
    date, description, kind, money: qa(money), debt: await debtAccount(kind, qa(money).currency), amount, contact: contact[person],
    rate: qa(money).currency === 'TRY' ? undefined : rateAt(qa(money).currency, date),
  }), tag)
/** Serbest kayıt: raw lines; a foreign-currency line carries its own base amount so the entry balances to the cent. */
type L = [account: string, amount: number, memo?: string, o?: { rate?: string; contact?: string }]
const serbest = (who: string, date: string, description: string, lines: L[], o: { ref?: string; tag?: string } = {}) =>
  post(who, date, () => ({
    date, description, reference: o.ref,
    lines: lines.map(([a, amount, memo, x]) => ({ account: byName(a).id, amount, memo, rate: x?.rate, contact: x?.contact ? contact[x.contact] : undefined })),
  }), o.tag)

// ---------- 07-01 opening balances (Serbest kayıt, many lines, mixed currencies) ----------
{
  const open: [string, number][] = [
    ['Ziraat Vadesiz', tl(150_000)], ['Garanti Vadesiz', tl(80_000)], ['Ahmet Cüzdan', tl(3_000)], ['Ayşe Cüzdan', tl(3_000)],
    ['Fatma Cüzdan', tl(3_000)], ['Dursun Cüzdan', tl(3_000)], ['Dolar Hesabı', tl(3_500)], ['Euro Hesabı', tl(1_200)],
    ['Hisse Portföyü', tl(60_000)], ['Araba', tl(450_000)], ['Bonus Kart', -tl(6_000)], ['World Kart', -tl(2_400)], ['Taşıt Kredisi', -tl(180_000)],
  ]
  post('Ahmet', '2026-07-01', () => {
    const lines = open.map(([a, amount]) => ({ account: byName(a).id, amount, memo: 'Açılış' }))
    const base = open.reduce((s, [a, amount]) => {
      const cur = byName(a).currency
      return s + (cur === 'TRY' ? amount : toBase(amount, rateAt(cur, '2026-07-01'), 2, 2))
    }, 0)
    return { date: '2026-07-01', description: 'Açılış bakiyeleri', reference: 'AÇILIŞ', lines: [...lines, { account: sysId('opening_balance'), amount: -base, memo: 'Açılış' }] }
  }, 'opening')
}

// ---------- monthly rhythm ----------
const months = [7, 8, 9]
for (const m of months) {
  const d = (n: number) => day(2026, m, n)
  const mm = String(m).padStart(2, '0')
  // Salaries and other income (Gelir)
  gelir('Ahmet', d(1), 'Ziraat Vadesiz', m === 9
    ? [['Maaş', tl(78_000)], ['Prim ve İkramiye', tl(15_000), 'Dönem primi']]
    : [['Maaş', tl(78_000)]], 'Maaş', { ref: `MAAŞ-${mm}` })
  gelir('Ayşe', d(2), 'Garanti Vadesiz', [['Maaş', tl(52_000)]], 'Ayşe maaş')
  gelir('Dursun', d(2), 'Dursun Cüzdan', [['Maaş', tl(38_000)]], 'Dursun maaş (elden)')
  gelir('Fatma', d(5), 'Garanti Vadesiz', [['Kira Geliri', tl(14_000)], ['Ek Gelir', tl(4_000 + m * 500), 'Çeviri işi']], 'Kira ve ek gelir')
  // Housing and bills
  gider('Ahmet', d(3), 'Ziraat Vadesiz', [['Kira', tl(m === 9 ? 26_000 : 24_000)]], 'Ev kirası', { ref: `KİRA-${mm}` })
  gider('Ahmet', d(4), 'Ziraat Vadesiz', [['Aidat', tl(1_350)]], 'Aidat')
  gider('Ahmet', d(5), 'Ziraat Vadesiz', [['Elektrik', tl(between(900, 1_400)), 'Fatura'], ['Su', tl(between(180, 320)), 'Fatura'], ['Doğalgaz', tl(m === 7 ? 380 : between(700, 1_500)), 'Fatura']], 'Fatura ödemeleri')
  gider('Ahmet', d(7), 'Bonus Kart', [['İnternet', tl(520)], ['Telefon', tl(1_150), 'Dört hat']], 'İnternet ve telefon')
  gider('Fatma', d(9), 'World Kart', [['Dijital Abonelik', tl(229.9), 'Netflix']], 'Netflix')
  // Loan installment: Serbest kayıt with principal, interest and fee
  serbest('Ahmet', d(10), 'Taşıt kredisi taksiti', [
    ['Taşıt Kredisi', tl(6_800 + m * 20), 'Anapara'], ['Kredi Faizi', tl(1_450 - m * 15), 'Faiz'], ['Kredi Masrafı', tl(25), 'Masraf'],
    ['Ziraat Vadesiz', -(tl(6_800 + m * 20) + tl(1_450 - m * 15) + tl(25))],
  ], { ref: `KREDİ-${mm}` })
  // Depreciation: Serbest kayıt against a contra-asset
  serbest('Ahmet', d(28), 'Araç amortismanı', [['Amortisman Gideri', tl(3_100)], ['Birikmiş Amortisman', -tl(3_100)]])
  // Savings and moves (Transfer)
  transfer('Ahmet', d(12), 'Ziraat Vadesiz', 'Garanti Vadesiz', tl(10_000), 'Garanti’ye aktarım', { fee: m === 8 ? tl(7.5) : undefined })
  const usd = 300
  transfer('Ahmet', d(15), 'Ziraat Vadesiz', 'Dolar Hesabı', Math.round(tl(usd) * Number(rateAt('USD', d(15)))),
    'Dolar alımı', { toAmount: tl(usd) })
  transfer('Ahmet', d(25), 'Ziraat Vadesiz', 'Hisse Portföyü', tl(5_000), 'Hisse alımı')
  // Card payments take what is owed on the day (Transfer asset → liability)
  post('Ahmet', d(20), async () => quick.transfer(book, {
    date: d(20), description: 'Bonus Kart ödemesi', from: qa('Ziraat Vadesiz'), to: qa('Bonus Kart'), amount: -(await bal('Bonus Kart', d(20))),
  }))
  post('Ayşe', d(26), async () => quick.transfer(book, {
    date: d(26), description: 'World Kart ödemesi (kısmi)', from: qa('Garanti Vadesiz'), to: qa('World Kart'),
    amount: Math.round(-(await bal('World Kart', d(26))) * 0.6 / 100) * 100,
  }))
  // Investment revaluation, card interest
  serbest('Ahmet', day(2026, m, 30 - (m === 8 ? 0 : 1)), 'Hisse portföyü değerleme', [['Hisse Portföyü', tl(between(900, 2_600))], ['Yatırım Değer Artışı', -0]].map((l, i, a) =>
    (i === 1 ? ['Yatırım Değer Artışı', -(a[0][1] as number)] : l) as L))
  serbest('Dursun', d(27), 'World Kart faiz tahakkuku', [['Kart Faizi', tl(between(120, 340))], ['World Kart', -0]].map((l, i, a) =>
    (i === 1 ? ['World Kart', -(a[0][1] as number)] : l) as L))
}

// ---------- daily life ----------
const wallet: Record<string, string> = { Ahmet: 'Ahmet Cüzdan', Ayşe: 'Ayşe Cüzdan', Fatma: 'Fatma Cüzdan', Dursun: 'Dursun Cüzdan' }
const card = (who: string) => (who === 'Ayşe' || who === 'Ahmet' ? 'Bonus Kart' : 'World Kart')
for (let i = 0; i < DAYS; i++) {
  const date = dateOf(i)
  const dow = new Date(START + i * 864e5).getUTCDay()
  const dom = Number(date.slice(8))
  // Fridays: each member tops up a wallet at the ATM (Transfer).
  if (dow === 5) {
    transfer('Ahmet', date, 'Ziraat Vadesiz', wallet.Ahmet, tl(2_500), 'ATM nakit çekim')
    transfer('Ayşe', date, 'Garanti Vadesiz', wallet.Ayşe, tl(2_500), 'ATM nakit çekim')
    transfer('Fatma', date, 'Garanti Vadesiz', wallet.Fatma, tl(2_000), 'ATM nakit çekim')
    transfer('Dursun', date, 'Ziraat Vadesiz', wallet.Dursun, tl(2_000), 'ATM nakit çekim')
  }
  // Ayşe: groceries (sometimes split across categories), restaurant, café
  if (rnd() < 0.4) {
    const total = tl(between(350, 1_900))
    if (rnd() < 0.25) {
      const a = Math.round(total * 0.6), b = Math.round(total * 0.25)
      gider('Ayşe', date, card('Ayşe'), [['Market', a, 'Gıda'], ['Ev Eşyası', b, 'Temizlik'], ['Kozmetik', total - a - b, 'Bakım']], 'Migros alışverişi')
    } else gider('Ayşe', date, rnd() < 0.7 ? card('Ayşe') : wallet.Ayşe, [['Market', total]], pick(['Market alışverişi', 'Migros', 'Manav ve market']))
  }
  if (rnd() < 0.12) gider('Ayşe', date, card('Ayşe'), [['Restoran', tl(between(450, 1_800))]], pick(['Akşam yemeği', 'Hafta sonu brunch', 'Arkadaşlarla yemek']))
  if (rnd() < 0.2) gider('Ayşe', date, wallet.Ayşe, [['Kafe & Kahve', tl(between(90, 260))]], 'Kahve')
  // Ahmet: occasional groceries, restaurant, books, doctor, sports
  if (rnd() < 0.15) gider('Ahmet', date, 'Bonus Kart', [['Market', tl(between(300, 1_100))]], 'Market')
  if (rnd() < 0.08) gider('Ahmet', date, 'Bonus Kart', [['Restoran', tl(between(600, 2_200))]], 'İş yemeği')
  if (rnd() < 0.05) gider('Ahmet', date, 'Bonus Kart', [['Kırtasiye & Kitap', tl(between(150, 700))]], 'Kitap')
  if (rnd() < 0.03) gider('Ahmet', date, 'Ziraat Vadesiz', [['Doktor & Hastane', tl(between(600, 2_500))], ['İlaç', tl(between(80, 400))]], 'Doktor kontrolü')
  if (dow === 6 && rnd() < 0.5) gider('Ahmet', date, 'Bonus Kart', [['Spor', tl(between(250, 600))]], 'Halı saha')
  // Fatma: clothing, cosmetics, hairdresser, delivery, electronics
  if (rnd() < 0.06) gider('Fatma', date, 'World Kart', [['Giyim', tl(between(800, 3_500))]], pick(['Mont', 'Ayakkabı', 'Elbise']))
  if (rnd() < 0.08) gider('Fatma', date, 'World Kart', [['Kozmetik', tl(between(200, 900))]], 'Kozmetik')
  if (rnd() < 0.04) gider('Fatma', date, wallet.Fatma, [['Kuaför & Berber', tl(between(400, 1_200))]], 'Kuaför')
  if (rnd() < 0.15) gider('Fatma', date, 'World Kart', [['Paket Servis', tl(between(220, 750))]], 'Yemek siparişi')
  if (rnd() < 0.02) gider('Fatma', date, 'World Kart', [['Elektronik', tl(between(1_500, 6_000))]], 'Kulaklık')
  // Dursun: fuel, parking, taxi, public transport, car service, delivery
  if (rnd() < 0.14) gider('Dursun', date, rnd() < 0.7 ? 'World Kart' : wallet.Dursun, [['Yakıt', tl(between(1_400, 3_200))]], 'Benzin')
  if (rnd() < 0.2) gider('Dursun', date, wallet.Dursun, [['Otopark & Geçiş', tl(between(30, 140))]], 'Otopark')
  if (rnd() < 0.08) gider('Dursun', date, wallet.Dursun, [['Taksi', tl(between(120, 450))]], 'Taksi')
  if (rnd() < 0.3) gider('Dursun', date, wallet.Dursun, [['Toplu Taşıma', tl(between(30, 90))]], 'İstanbulkart')
  if (rnd() < 0.12) gider('Dursun', date, wallet.Dursun, [['Kafe & Kahve', tl(between(80, 220))]], 'Çay kahve')
  // Split payment: one purchase paid from two sources (Gider with per-row money account)
  if (dom === 14 && rnd() < 0.7)
    gider('Dursun', date, 'World Kart', [['Araç Bakım & Servis', tl(5_200), 'Yağ ve filtre', 'World Kart'], ['Araç Bakım & Servis', tl(800), 'Lastik rotasyonu', wallet.Dursun]], 'Periyodik bakım')
}

// ---------- special scenarios ----------
// Gider variants: foreign-currency accounts, base-currency splits from a USD account, EUR trip
gider('Fatma', '2026-08-03', 'Euro Hesabı', [['Yurtdışı Tatil', 420_00, 'Otel']], 'Roma otel', { ref: 'ROMA-1' })
gider('Fatma', '2026-08-04', 'Euro Hesabı', [['Yurtdışı Tatil', 86_50, 'Müze'], ['Restoran', 112_00, 'Akşam yemeği']], 'Roma gezi', { rate: rateAt('EUR', '2026-08-04') })
gider('Fatma', '2026-08-05', 'Euro Hesabı', [['Tatil', 60_00, 'Hediyelik'], ['Hediye & Bağış', 25_00]], 'Roma hediyelik', { rate: rateAt('EUR', '2026-08-05') })
gider('Ahmet', '2026-07-20', 'Dolar Hesabı', [['Dijital Abonelik', 49_00, 'Yıllık abonelik']], 'Yazılım aboneliği (USD)', { rate: rateAt('USD', '2026-07-20') })
gider('Ahmet', '2026-09-18', 'Dolar Hesabı', [['Eğitim', 150_00, 'Kurs']], 'Online kurs', { rate: '41.55' }) // user-given rate beats the stored one
gider('Ayşe', '2026-07-12', 'Garanti Vadesiz', [['Taksi', tl(180)], ['Toplu Taşıma', tl(60)]], 'Ulaşım toplu', { ref: 'FİŞ-1204' })
gider('Ayşe', '2026-09-02', 'Bonus Kart', [['Eğitim', tl(4_500), 'Dönem ücreti'], ['Kırtasiye & Kitap', tl(650), 'Kitaplar'], ['Aile & Çocuk', tl(1_200), 'Kreş']], 'Okul açılışı')
gider('Dursun', '2026-08-22', 'Ziraat Vadesiz', [['Trafik Sigortası & Kasko', tl(14_800)]], 'Kasko yenileme', { ref: 'POL-77821' })
gider('Ahmet', '2026-09-10', 'Ziraat Vadesiz', [['Vergi & Resmi Ödeme', tl(2_750)]], 'Motorlu taşıtlar vergisi')
gider('Fatma', '2026-07-30', 'Fatma Cüzdan', [['Hediye & Bağış', tl(500)]], 'Bağış')
gider('Ahmet', '2026-08-18', 'Ahmet Cüzdan', [['Tadilat & Onarım', tl(1_850), 'Tesisatçı']], 'Banyo musluğu')
// Gelir variants
gelir('Fatma', '2026-07-31', 'Dolar Hesabı', [['Dolar Faiz Geliri', 12_40]], 'USD faizi')
gelir('Fatma', '2026-09-30', 'Dolar Hesabı', [['Dolar Faiz Geliri', 14_10]], 'USD faizi')
gelir('Fatma', '2026-08-25', 'Dolar Hesabı', [['Faiz Gelirleri', 8_00]], 'Vadeli faiz (TRY hesaplı)', { rate: rateAt('USD', '2026-08-25') })
gelir('Ahmet', '2026-08-20', 'Ziraat Vadesiz', [['Temettü Gelirleri', tl(1_900)]], 'Temettü')
gelir('Dursun', '2026-09-12', 'Dursun Cüzdan', [['Harçlık', tl(1_500)], ['Hediye', tl(1_000), 'Doğum günü']], 'Aileden')
gelir('Ayşe', '2026-07-22', 'Garanti Vadesiz', [['Ek Gelir', tl(3_200)]], 'Ders ücreti')
// Serbest kayıt variants
serbest('Fatma', '2026-08-14', 'Serbest meslek faturası (USD)', [
  ['Dolar Hesabı', 800_00, 'Müşteri ödemesi'], ['Serbest Meslek Geliri (USD)', -800_00],
])
serbest('Ayşe', '2026-09-08', 'Kart iadesi', [['Bonus Kart', tl(899), 'İade'], ['Giyim', -tl(899)]], { ref: 'İADE-55' })
serbest('Ahmet', '2026-09-30', 'Dönem sonu düzeltmesi', [
  ['Ziraat Vadesiz', -tl(120)], ['Bank Fees', tl(120), 'Hesap işletim ücreti'],
])
serbest('Ahmet', '2026-07-05', 'Eski bankadan devir', [['Eski Banka', tl(2_000)], ['Opening Balances', -tl(2_000)]])
transfer('Ahmet', '2026-07-06', 'Eski Banka', 'Ziraat Vadesiz', tl(2_000), 'Eski hesap kapatma')
// Transfer variants: sell USD, EUR buy/sell, cross USD→EUR, fee
{
  const t = (d: string, cur: string, n: number) => Math.round(n * Number(rateAt(cur, d)) * 100)
  transfer('Fatma', '2026-08-28', 'Dolar Hesabı', 'Ziraat Vadesiz', tl(500), 'Dolar bozdurma', { toAmount: t('2026-08-28', 'USD', 500) })
  transfer('Fatma', '2026-07-27', 'Garanti Vadesiz', 'Euro Hesabı', t('2026-07-27', 'EUR', 800), 'Euro alımı', { toAmount: tl(800) })
  transfer('Fatma', '2026-09-21', 'Euro Hesabı', 'Garanti Vadesiz', tl(300), 'Euro bozdurma', { toAmount: t('2026-09-21', 'EUR', 300) })
  const rate = rateAt('EUR', '2026-09-24')
  const eur = 200
  const usdOut = Math.round((eur * Number(rate)) / Number(rateAt('USD', '2026-09-24')) * 100)
  transfer('Fatma', '2026-09-24', 'Euro Hesabı', 'Dolar Hesabı', tl(eur), 'EUR → USD', { toAmount: usdOut, rate })
  transfer('Dursun', '2026-08-09', 'Ziraat Vadesiz', 'Garanti Vadesiz', tl(3_000), 'EFT (başka banka)', { fee: tl(12.5) })
  transfer('Dursun', '2026-09-16', 'Dursun Cüzdan', 'Ziraat Vadesiz', tl(2_000), 'Bankaya yatırma')
}
// Borç: all four kinds, partial settlement, foreign currency, brand/business contact
borc('Ahmet', '2026-07-08', 'lend', 'Ali Yılmaz', 'Ziraat Vadesiz', tl(5_000), 'Ali’ye borç verildi')
borc('Ahmet', '2026-08-20', 'collect', 'Ali Yılmaz', 'Ahmet Cüzdan', tl(2_000), 'Ali ilk taksit')
borc('Ahmet', '2026-09-15', 'collect', 'Ali Yılmaz', 'Ziraat Vadesiz', tl(1_000), 'Ali ikinci taksit')
borc('Ayşe', '2026-07-14', 'borrow', 'Zeynep Kaya', 'Garanti Vadesiz', tl(3_000), 'Zeynep’ten borç alındı')
borc('Ayşe', '2026-08-18', 'repay', 'Zeynep Kaya', 'Ayşe Cüzdan', tl(1_000), 'Zeynep’e ödeme')
borc('Ayşe', '2026-09-20', 'repay', 'Zeynep Kaya', 'Garanti Vadesiz', tl(2_000), 'Zeynep borç kapandı')
borc('Fatma', '2026-07-18', 'lend', 'Mehmet Demir', 'Dolar Hesabı', 250_00, 'Mehmet’e dolar borç')
borc('Fatma', '2026-09-05', 'collect', 'Mehmet Demir', 'Dolar Hesabı', 100_00, 'Mehmet kısmi iade')
borc('Dursun', '2026-08-02', 'borrow', 'Hasan Usta', 'Dursun Cüzdan', tl(4_000), 'Usta’dan avans')
borc('Dursun', '2026-09-25', 'repay', 'Hasan Usta', 'Dursun Cüzdan', tl(1_500), 'Usta’ya ödeme')
borc('Dursun', '2026-09-27', 'borrow', 'Migros', 'Garanti Vadesiz', tl(900), 'Market veresiye')
borc('Ahmet', '2026-08-12', 'borrow', 'Apartman Yönetimi', 'Ziraat Vadesiz', tl(1_350), 'Aidat avansı')
borc('Ahmet', '2026-09-04', 'repay', 'Apartman Yönetimi', 'Ziraat Vadesiz', tl(1_350), 'Aidat avansı iadesi')
// Mistakes to edit or delete later
gider('Ayşe', '2026-07-16', 'Bonus Kart', [['Market', tl(740)]], 'Market', { tag: 'fix-amount' })
gider('Fatma', '2026-07-17', 'World Kart', [['Restoran', tl(620)]], 'yemek', { tag: 'fix-desc' })
gider('Dursun', '2026-08-06', 'Dursun Cüzdan', [['Yakıt', tl(2_100)]], 'Benzin', { tag: 'fix-date' })
gider('Ayşe', '2026-08-07', 'Bonus Kart', [['Kafe & Kahve', tl(135)]], 'Kahve', { tag: 'dup-ayse' })
gider('Ayşe', '2026-08-07', 'Bonus Kart', [['Kafe & Kahve', tl(135)]], 'Kahve', { tag: 'dup-ayse-2' })
gider('Fatma', '2026-09-11', 'World Kart', [['Giyim', tl(1_750)]], 'Çanta (yanlış kayıt)', { tag: 'del-fatma' })
gider('Ayşe', '2026-09-13', 'Bonus Kart', [['Market', tl(480)]], 'market', { tag: 'admin-fix' })

// ---------- run ----------
events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.seq - b.seq))
for (const e of events) {
  as(e.who)
  try {
    await e.run()
  } catch (err) {
    console.error(`FAILED ${e.date} ${e.who}`, err)
    throw err
  }
}

// ---------- edits and deletes ----------
{
  const lineOf = async (tag: string) => (await api.call('entries.get', { id: posted[tag].id })).lines
  const t = (tag: string) => posted[tag]
  as('Ayşe')
  await api.call('entries.update', {
    id: t('fix-amount').id,
    lines: (await lineOf('fix-amount')).map((l) => ({ account: l.account, amount: l.amount > 0 ? tl(784.5) : -tl(784.5) })),
  })
  as('Fatma')
  await api.call('entries.update', { id: t('fix-desc').id, description: 'Akşam yemeği (Kadıköy)', reference: 'FİŞ-8841' })
  as('Dursun')
  await api.call('entries.update', { id: t('fix-date').id, date: '2026-08-05' })
  as('Ayşe')
  await api.call('entries.delete', { id: t('dup-ayse-2').id })
  as('Fatma')
  await api.call('entries.delete', { id: t('del-fatma').id })
  // A member cannot touch another member's entry; the admin can.
  as('Dursun')
  await api.call('entries.update', { id: t('admin-fix').id, description: 'x' }).then(
    () => { throw new Error('member edited someone else’s entry') },
    (e) => { if (e.code !== 'entry_not_owner') throw e })
  as('Ahmet')
  await api.call('entries.update', { id: t('admin-fix').id, description: 'Market (Ahmet düzeltti)' })
  // Housekeeping: an unused account goes, a closed one is archived, a rate and a contact are corrected.
  await api.call('accounts.delete', { id: trash })
  await api.call('accounts.archive', { id: byName('Eski Banka').id, archived: true })
  await api.call('fx.set', { currency: 'USD', date: '2026-07-01', rate: rates.USD[0].rate })
  await api.call('contacts.update', { id: contact['Hasan Usta'], name: 'Hasan Usta (Oto Servis)' })
}

// ---------- report ----------
const tb = await api.call('reports.trialBalance', {})
const all = await api.call('entries.list', { limit: 1 })
console.log(`seeded ${path}`)
console.log(`entries: ${(all as { total?: number }).total ?? '?'}; events planned: ${events.length}`)
console.log('trial balance:', JSON.stringify(tb).slice(0, 200))
