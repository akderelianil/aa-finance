// Claude Code PreToolUse hook: blocks edits to an applied migration (rule: never edit an applied migration).
// A migration is "applied" once it is tracked by git. A new file (untracked) may be written.
import { execFileSync } from 'node:child_process'
import { isAbsolute, relative, resolve } from 'node:path'

type HookInput = { tool_name?: string; tool_input?: { file_path?: string } }
export type Decision = { block: boolean; reason: string }

const WRITE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit'])
const MIGRATION = /^src\/core\/migrations\/[^/]+\.sql$/

/** Pure decision. `isTracked` takes an absolute path. */
export function decide(input: HookInput, root: string, isTracked: (file: string) => boolean): Decision {
  const allow = { block: false, reason: '' }
  const given = input.tool_input?.file_path
  if (!input.tool_name || !WRITE_TOOLS.has(input.tool_name) || !given) return allow
  const file = isAbsolute(given) ? given : resolve(root, given)
  if (!MIGRATION.test(relative(root, file).split('\\').join('/'))) return allow
  if (!isTracked(file)) return allow
  return {
    block: true,
    reason: `Blocked: ${relative(root, file)} is an applied migration and must not change. Add src/core/migrations/NNNN_name.sql instead.`,
  }
}

function gitTracked(root: string): (file: string) => boolean {
  return (file) => {
    try {
      execFileSync('git', ['ls-files', '--error-unmatch', '--', file], { cwd: root, stdio: 'ignore' })
      return true
    } catch {
      return false
    }
  }
}

if (import.meta.main) {
  const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd()
  let input: HookInput = {}
  try {
    input = JSON.parse(await new Response(process.stdin as never).text()) as HookInput
  } catch {
    process.exit(0) // unreadable input: never block on a guard error
  }
  const out = decide(input, root, gitTracked(root))
  if (out.block) {
    console.error(out.reason)
    process.exit(2)
  }
}
