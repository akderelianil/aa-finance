// Finds every error code the API can produce. Test and docs-generator support; the app does not ship this.
import { readdirSync, readFileSync } from 'node:fs'
import { dbErrorCodes, uniqueErrorCodes } from '../api/errors.ts'

/** Codes the API raises itself: fail('code'), new ApiError('code'), including ternaries on the same line. */
export function apiRaisedCodes(): Set<string> {
  const dir = new URL('../api/', import.meta.url)
  const files = [
    ...readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.includes('.test.')).map((f) => new URL(f, dir)),
    new URL('../quick.ts', import.meta.url),
  ]
  const codes = new Set<string>()
  for (const file of files)
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const at = line.search(/\b(?:fail|ApiError)\(/)
      if (at < 0) continue
      for (const m of line.slice(at).matchAll(/'([a-z]+(?:_[a-z]+)*)'/g)) codes.add(m[1])
    }
  return codes
}

export type CodeOrigin = 'trigger' | 'unique' | 'api'

/** Every code with where it comes from, sorted by code. A trigger or unique code wins over an api mention. */
export function allErrorCodes(): { code: string; origin: CodeOrigin }[] {
  const found = new Map<string, CodeOrigin>()
  for (const code of apiRaisedCodes()) found.set(code, 'api')
  for (const code of ['internal', 'unknown_op', 'invalid_input']) found.set(code, 'api')
  for (const [, code] of uniqueErrorCodes) found.set(code, 'unique')
  for (const code of dbErrorCodes) found.set(code, 'trigger')
  return [...found].map(([code, origin]) => ({ code, origin })).sort((a, b) => a.code.localeCompare(b.code))
}
