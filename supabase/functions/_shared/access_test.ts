import { assertEquals } from 'jsr:@std/assert@1'
import { canModify } from './entries.ts'

const member = { member_id: 'a', role: 'member' }
const admin = { member_id: 'adm', role: 'admin' }

Deno.test('canModify: owner and admin always', () => {
  for (const need of ['edit', 'delete'] as const) {
    assertEquals(canModify(member, 'a', undefined, need), true)
    assertEquals(canModify(admin, 'b', undefined, need), true)
  }
})

Deno.test('canModify: other member needs a right', () => {
  assertEquals(canModify(member, 'b', undefined, 'edit'), false)
  assertEquals(canModify(member, 'b', undefined, 'delete'), false)
  assertEquals(canModify(member, 'b', 'edit', 'edit'), true)
  assertEquals(canModify(member, 'b', 'edit', 'delete'), false)
  assertEquals(canModify(member, 'b', 'delete', 'edit'), true)
  assertEquals(canModify(member, 'b', 'delete', 'delete'), true)
})
