// Runs the story-lifecycle ledger from the ECC plugin cache, so no version number is pinned anywhere.
// Run: npm run story -- status   (any ledger.js command works; --root is added when missing)
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ECC_CACHE = join(homedir(), '.claude', 'plugins', 'cache', 'ecc', 'ecc')
const LEDGER_PARTS = ['skills', 'story-lifecycle', 'scripts', 'ledger.js']

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/** Path of the ledger in the highest installed ECC version that ships one, or null. */
export function findLedger(cacheDir: string = ECC_CACHE): string | null {
  if (!existsSync(cacheDir)) return null
  const versions = readdirSync(cacheDir).sort(compareVersions).reverse()
  for (const version of versions) {
    const candidate = join(cacheDir, version, ...LEDGER_PARTS)
    if (existsSync(candidate)) return candidate
  }
  return null
}

function main(args: string[]): number {
  const ledger = findLedger()
  if (!ledger) {
    console.error(`story: no ledger.js under ${ECC_CACHE}. Is the ecc plugin installed?`)
    return 1
  }
  const withRoot = args.includes('--root') ? args : [...args, '--root', '.']
  return spawnSync(process.execPath, [ledger, ...withRoot], { stdio: 'inherit' }).status ?? 1
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)))
