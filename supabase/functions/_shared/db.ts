import postgres from 'npm:postgres@3'

// Doğrudan Postgres bağlantısı: yazmalar tek transaction'da, RLS'i aşarak yapılır.
// Yetki kontrolü fonksiyonların sorumluluğundadır.
export const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { max: 3, prepare: false })

export type Tx = postgres.Sql

// Denetim logunda işlemi yapan üyenin görünmesi için (audit_row trigger'ı okur).
export async function setActor(tx: Tx, memberId: string) {
  await tx`select set_config('app.member_id', ${memberId}, true)`
}
