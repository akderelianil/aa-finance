import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { clearKept, getKept, MemberContext, setKept, useKept } from './kept.ts'

test('kept state is per member and survives until cleared', () => {
  setKept(1, 'quick.description', 'taksi')
  setKept(2, 'quick.description', 'kira')
  assert.equal(getKept(1, 'quick.description'), 'taksi')
  assert.equal(getKept(2, 'quick.description'), 'kira')
  assert.equal(getKept(3, 'quick.description'), undefined)
})

test('clearKept drops a prefix for one member only', () => {
  setKept(1, 'quick.open', true)
  setKept(1, 'draft', { id: null })
  setKept(2, 'quick.open', true)
  clearKept(1, 'quick.')
  assert.equal(getKept(1, 'quick.open'), undefined)
  assert.deepEqual(getKept(1, 'draft'), { id: null })
  assert.equal(getKept(2, 'quick.open'), true)
  clearKept(1)
  assert.equal(getKept(1, 'draft'), undefined)
})

test('useKept starts from the member kept value, else from the initial value', () => {
  setKept(7, 'draft.note', 'saved')
  const Probe = ({ slot, initial }: { slot: string; initial: string | (() => string) }) => {
    const [value] = useKept(slot, initial)
    return createElement('span', null, value)
  }
  const html = (member: number | null, slot: string, initial: string | (() => string)) =>
    renderToStaticMarkup(createElement(MemberContext.Provider, { value: member }, createElement(Probe, { slot, initial })))
  assert.equal(html(7, 'draft.note', 'fresh'), '<span>saved</span>')
  assert.equal(html(7, 'draft.other', 'fresh'), '<span>fresh</span>')
  assert.equal(html(7, 'draft.other', () => 'lazy'), '<span>lazy</span>')
  assert.equal(html(null, 'draft.note', 'fresh'), '<span>fresh</span>')
  assert.equal(html(8, 'draft.note', 'fresh'), '<span>fresh</span>')
  clearKept(7)
})
