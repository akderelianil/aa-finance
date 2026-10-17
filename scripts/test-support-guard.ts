// A shipped build must not carry the `test-support` feature of aa-core (it opens the raw database
// connection and the means to break rules). Only dev-dependencies may enable it.
// Run: npm run test-support:check
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const FEATURE = 'test-support'

/** The lines of `cargo tree` output (package and features) that enable the feature. */
export function findLeaks(treeOutput: string): string[] {
  return treeOutput
    .split('\n')
    .filter((line) => line.includes('[') && /\[(?:[^\]]*,)?test-support(?:,[^\]]*)?\]/.test(line))
    .map((line) => line.trim())
}

function main(): number {
  // Normal and build edges are what a release links; dev edges are left out on purpose.
  const tree = execFileSync(
    'cargo',
    ['tree', '--workspace', '-e', 'normal,build', '-f', '{p} [{f}]', '--prefix', 'none'],
    { cwd: ROOT, encoding: 'utf8' },
  )
  const leaks = findLeaks(tree)
  if (leaks.length === 0) return 0
  console.error(`the ${FEATURE} feature reaches a shipped build:\n${leaks.join('\n')}`)
  return 1
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main())
