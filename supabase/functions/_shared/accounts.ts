import { Tx } from './db.ts'
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
