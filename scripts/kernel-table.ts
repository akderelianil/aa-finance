// Keeps the kernel table of ADR-0021 honest: every rule code of the core appears in the ADR, and every
// test the ADR names after a file exists as a function in the Rust sources. Run: npm run kernel:check
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const ERROR_RS = join(ROOT, 'crates', 'core', 'src', 'error.rs')
const ADR_PATH = join(ROOT, 'docs', 'adr', '0021-sealed-ledger-kernel.md')
const CRATES = join(ROOT, 'crates')

/** The code strings of `RuleCode::as_str`, in file order. */
export function extractRuleCodes(errorSource: string): string[] {
  return [...errorSource.matchAll(/RuleCode::\w+\s*=>\s*"([a-z_]+)"/g)].map((m) => m[1])
}

/** Test names written as `file.rs: \`name\`, \`name\`` in the ADR. Rows that name no test are skipped. */
export function extractTestAnchors(adr: string): string[] {
  const anchors: string[] = []
  for (const group of adr.matchAll(/\.rs: ((?:`[a-z0-9_]+`(?:, )?)+)/g)) {
    for (const name of group[1].matchAll(/`([a-z0-9_]+)`/g)) anchors.push(name[1])
  }
  return anchors
}

/** Every problem found, as a sentence; empty when the table is complete and its anchors exist. */
export function findProblems(codes: string[], adr: string, functions: Set<string>): string[] {
  const missingCodes = codes.filter((code) => !adr.includes(`\`${code}\``))
  const missingTests = extractTestAnchors(adr).filter((name) => !functions.has(name))
  return [
    ...missingCodes.map((code) => `rule code ${code} is not in ADR-0021`),
    ...missingTests.map((name) => `test ${name} named in ADR-0021 does not exist`),
  ]
}

function rustSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'target' ? [] : rustSources(path)
    return entry.name.endsWith('.rs') ? [path] : []
  })
}

export function checkKernelTable(): string[] {
  const functions = new Set<string>()
  for (const file of rustSources(CRATES)) {
    for (const m of readFileSync(file, 'utf8').matchAll(/\bfn\s+(\w+)/g)) functions.add(m[1])
  }
  const codes = extractRuleCodes(readFileSync(ERROR_RS, 'utf8'))
  return findProblems(codes, readFileSync(ADR_PATH, 'utf8'), functions)
}

function main(): number {
  const problems = checkKernelTable()
  for (const problem of problems) console.error(`kernel-table: ${problem}`)
  return problems.length === 0 ? 0 : 1
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main())
