// Dev only: a fresh local book with three months of entries, for UI work and screenshots.
// Run: node scripts/dev/seed-local.ts [file]   (default .dev/aa-finance.sqlite; stop `vite` first, it holds the file)
import { mkdirSync, rmSync } from 'node:fs'
import { dirname } from 'node:path'
import { createApi } from '../../src/core/api/index.ts'
import { migrate } from '../../src/core/migrate.ts'
import { openNodeDb, readMigrations } from '../../src/core/test/node-db.ts'

const path = process.argv[2] ?? '.dev/aa-finance.sqlite'
mkdirSync(dirname(path), { recursive: true })
for (const f of [path, `${path}-wal`, `${path}-shm`]) rmSync(f, { force: true })
const db = openNodeDb(path)
await migrate(db, readMigrations())
const api = createApi(db)
await api.call('setup.run', { baseCurrency: 'TRY', language: 'tr', userName: 'Demo', recommended: true })

const list = () => api.call('accounts.list', {})
const find = async (pred: (a: Awaited<ReturnType<typeof list>>[number]) => boolean) => {
  const a = (await list()).find(pred)
  if (!a) throw new Error('account not found')
  return a.uid
}
const sys = (key: string) => find((a) => a.systemKey === key)
const named = (name: string) => find((a) => a.name === name)
const add = async (parent: string, name: string, currency?: string) =>
  (await api.call('accounts.create', { parent: await sys(parent), name, currency })).uid

const bank = await add('bank', 'Ziraat Vadesiz')
const usd = await add('bank', 'Dolar Hesabı', 'USD')
const card = await add('credit_cards', 'Bonus Kart')
const friend = await add('receivables', 'Ali')
const wallet = await named('Cüzdan')
const opening = await sys('opening_balance')
const [salary, groceries, rent, restaurant, fuel] = await Promise.all(['Maaş', 'Market', 'Kira', 'Restoran', 'Yakıt'].map(named))

await api.call('fx.set', { currency: 'USD', date: '2026-07-01', rate: '40.25' })
await api.call('fx.set', { currency: 'USD', date: '2026-09-01', rate: '41.10' })

const post = (date: string, description: string, lines: { account: string; amount: number }[]) =>
  api.call('entries.post', { date, description, lines })

await post('2026-07-01', 'Açılış bakiyeleri', [
  { account: bank, amount: 85_000_00 }, { account: wallet, amount: 12_500_00 }, { account: opening, amount: -97_500_00 },
])
await api.call('entries.post', {
  date: '2026-07-01', description: 'Dolar açılış', lines: [
    { account: usd, amount: 1_000_00 }, { account: opening, amount: -40_250_00 },
  ],
})
for (const m of ['07', '08', '09']) {
  await post(`2026-${m}-01`, 'Maaş', [{ account: bank, amount: 65_000_00 }, { account: salary, amount: -65_000_00 }])
  await post(`2026-${m}-03`, 'Ev kirası', [{ account: rent, amount: 22_000_00 }, { account: bank, amount: -22_000_00 }])
  for (const d of ['06', '13', '20', '27']) {
    const amt = 1_200_00 + Number(d) * 37_00
    await post(`2026-${m}-${d}`, 'Market alışverişi', [{ account: groceries, amount: amt }, { account: card, amount: -amt }])
  }
  await post(`2026-${m}-15`, 'Akşam yemeği', [{ account: restaurant, amount: 1_850_00 }, { account: wallet, amount: -1_850_00 }])
  await post(`2026-${m}-18`, 'Benzin', [{ account: fuel, amount: 2_400_00 }, { account: card, amount: -2_400_00 }])
  await post(`2026-${m}-25`, 'Kart ödemesi', [{ account: card, amount: 9_000_00 }, { account: bank, amount: -9_000_00 }])
}
await post('2026-08-10', 'Ali’ye borç', [{ account: friend, amount: 5_000_00 }, { account: wallet, amount: -500_00 }, { account: bank, amount: -4_500_00 }])
console.log(`seeded ${path}`)
