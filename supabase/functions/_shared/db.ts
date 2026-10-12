import postgres from 'npm:postgres@3'

// Doğrudan Postgres bağlantısı: yazmalar tek transaction'da, RLS'i aşarak yapılır.
// Yetki kontrolü fonksiyonların sorumluluğundadır.
// DB_POOL_URL = Supavisor transaction pooler (6543). Direct connections per isolate filled max_connections (53300).
export const sql = postgres(Deno.env.get('DB_POOL_URL') ?? Deno.env.get('SUPABASE_DB_URL')!, {
  max: 1, prepare: false, idle_timeout: 20,
})

export type Tx = postgres.Sql

// Denetim logunda işlemi yapan üyenin görünmesi için (audit_row trigger'ı okur).
export async function setActor(tx: Tx, memberId: string) {
  await tx`select set_config('app.member_id', ${memberId}, true)`
}
