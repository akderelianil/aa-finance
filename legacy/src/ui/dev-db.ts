// Dev only: the Db over HTTP to the Vite plugin in scripts/dev-db.ts (plain browser, no Tauri).
import type { Db, Row } from '../core/db.ts'

async function post<T>(body: object): Promise<T> {
  const res = await fetch('/__db', { method: 'POST', body: JSON.stringify(body) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export const devDb: Db = {
  query: (sql, params = []) => post<Row[]>({ op: 'query', sql, params }),
  batch: async (statements) => void (await post({ op: 'batch', statements })),
}
