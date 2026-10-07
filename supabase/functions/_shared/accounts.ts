import { Tx } from './db.ts'
import { HttpError } from './http.ts'
import { uuidv7 } from './uuid.ts'

// Grup seviyesindeki sistem kategorileri (kullanıcıya hazır hesap gibi görünmez).
export async function createGroupSystemAccounts(tx: Tx, groupId: string) {
  await tx`
    insert into accounts (id, group_id, type, name, system_key) values
      (${uuidv7()}, ${groupId}, 'income', 'Kur Farkı', 'fx_gain_loss'),
      (${uuidv7()}, ${groupId}, 'income', 'Yatırım Kâr/Zarar', 'investment_gain_loss')`
}

// Üye başına açılış bakiyesi (özkaynak) hesabı; grubun ana para biriminde.
export async function createOpeningBalanceAccount(
  tx: Tx,
  groupId: string,
  memberId: string,
  currency: string,
) {
  await tx`
    insert into accounts (id, group_id, owner_member_id, type, name, currency, system_key)
    values (${uuidv7()}, ${groupId}, ${memberId}, 'equity', 'Açılış Bakiyesi', ${currency}, 'opening_balance')`
}

// Kredi kartı kesim / son ödeme günü (kart başına bir kez; Yaklaşanlar buradan türer). Alan verilmezse dokunulmaz.
export async function saveCardDays(tx: Tx, accountId: string, body: Record<string, unknown>) {
  if (body.statement_day === undefined && body.due_day === undefined) return
  const day = (v: unknown) => {
    if (v === null || v === '' || v === undefined) return null
    const n = Number(v)
    if (!Number.isInteger(n) || n < 1 || n > 31) throw new HttpError(422, 'Gün geçersiz', 'invalid_day')
    return n
  }
  const statement = day(body.statement_day)
  const due = day(body.due_day)
  await tx`
    insert into credit_card_settings (account_id, statement_day, due_day) values (${accountId}, ${statement}, ${due})
    on conflict (account_id) do update set statement_day = excluded.statement_day, due_day = excluded.due_day`
}
