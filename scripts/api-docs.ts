// Renders docs/api/v1.md from the contract api/v1/api.json, so the readable reference cannot drift from it.
// Run: npm run api:docs   Check: npm run api:docs:check
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const CONTRACT_PATH = join(ROOT, 'api', 'v1', 'api.json')
const DOC_PATH = join(ROOT, 'docs', 'api', 'v1.md')

interface Operation {
  summary: string
  input: unknown
  output: unknown
  errors: string[]
}

export interface Contract {
  title: string
  description: string
  api_version: string
  global_errors: string[]
  operations: Record<string, Operation>
  $defs: Record<string, unknown>
}

/** A schema as one short line: `$ref` names, scalar types, and `{field, field?}` for objects. */
export function describeSchema(schema: any): string {
  if (schema.$ref) return `\`${String(schema.$ref).split('/').pop()}\``
  if (schema.oneOf) return schema.oneOf.map(describeSchema).join(' or ')
  if (schema.enum) return schema.enum.map((v: string) => `\`${v}\``).join(' | ')
  if (schema.type === 'array') return `list of ${describeSchema(schema.items)}`
  if (schema.type === 'object') {
    const required = new Set<string>(schema.required ?? [])
    const fields = Object.entries(schema.properties ?? {}).map(
      ([name, field]) => `${name}${required.has(name) ? '' : '?'}: ${describeSchema(field)}`,
    )
    return fields.length === 0 ? '`{}`' : `{ ${fields.join(', ')} }`
  }
  const type = Array.isArray(schema.type) ? schema.type.join(' or ') : schema.type
  return `\`${type}\``
}

export function renderApi(contract: Contract): string {
  const out = [
    `# ${contract.title}, version ${contract.api_version}`,
    '',
    '_Generated from [`api/v1/api.json`](../../api/v1/api.json) by `npm run api:docs`. Do not edit by hand: change the contract first (ADR-0023)._',
    '',
    contract.description,
    '',
    `Every operation can also return: ${contract.global_errors.map((c) => `\`${c}\``).join(', ')}.`,
    '',
    '## Operations',
    '',
  ]
  for (const [name, op] of Object.entries(contract.operations)) {
    out.push(`### \`${name}\``, '', op.summary, '')
    out.push(`- Input: ${describeSchema(op.input)}`, `- Output: ${describeSchema(op.output)}`)
    out.push(`- Errors: ${op.errors.length ? op.errors.map((c) => `\`${c}\``).join(', ') : 'none of its own'}`, '')
  }
  out.push('## Shared shapes', '')
  for (const [name, schema] of Object.entries(contract.$defs)) {
    if (name === 'ErrorCode') continue
    const description = (schema as any).description
    out.push(`- \`${name}\`: ${describeSchema({ ...(schema as object), $ref: undefined })}${description ? `. ${description}` : ''}`)
  }
  out.push('', '## Error codes', '', ((contract.$defs.ErrorCode as any).enum as string[]).map((c) => `\`${c}\``).join(', '), '')
  return out.join('\n')
}

function main(args: string[]): number {
  const fresh = renderApi(JSON.parse(readFileSync(CONTRACT_PATH, 'utf8')))
  if (args.includes('--check')) {
    const current = existsSync(DOC_PATH) ? readFileSync(DOC_PATH, 'utf8') : ''
    if (current === fresh) return 0
    console.error('docs/api/v1.md is out of date. Run: npm run api:docs')
    return 1
  }
  mkdirSync(dirname(DOC_PATH), { recursive: true })
  writeFileSync(DOC_PATH, fresh)
  return 0
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)))
