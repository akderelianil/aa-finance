// What the signed-in member may change. The API and the database enforce it; this only hides controls that would fail.
import type { Grants } from '../../core/api/members.ts'
import { useOp } from './api.ts'

const NONE: Grants = { accounts: false, rates: false, contacts: false }

/** None while the member list loads, so a control never shows up and then disappears. */
export function useGrants(): Grants {
  const members = useOp('members.list', {})
  return members.data?.find((m) => m.me)?.grants ?? NONE
}
