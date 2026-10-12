// Stable error codes. Triggers raise the database codes; the API adds its own. The UI maps codes to messages.

const dbCodes = new Set([
  'account_archived', 'account_deleted', 'account_field_fixed', 'account_has_children', 'account_has_lines',
  'account_locked', 'account_parent_cycle', 'account_parent_missing', 'account_parent_type', 'account_placeholder',
  'base_currency_fixed', 'base_currency_missing', 'currency_fixed', 'currency_unknown', 'entry_insert_draft',
  'entry_not_draft', 'entry_number_fixed', 'entry_posted', 'entry_too_few_lines', 'entry_unbalanced',
  'line_base_mismatch', 'line_date_mismatch', 'line_entry_fixed', 'line_insert_deleted', 'line_rate_required',
  'log_immutable', 'no_delete', 'period_locked', 'row_deleted', 'setting_key_fixed',
  'actor_kind_fixed', 'actor_role_invalid', 'admin_only', 'entry_not_owner', 'last_admin', 'member_role_missing',
])

// "UNIQUE constraint failed: <columns>" → code.
const uniqueCodes: [string, string][] = [
  ['accounts.parent_id, accounts.name', 'account_name_taken'],
  ['accounts.code', 'account_code_taken'],
  ['fx_rates.currency_id, fx_rates.date', 'fx_rate_exists'],
  ['settings.key', 'already_setup'],
]

export class ApiError extends Error {
  readonly code: string
  readonly details?: unknown
  constructor(code: string, details?: unknown) {
    super(code)
    this.name = 'ApiError'
    this.code = code
    this.details = details
  }
}

/** Any thrown value → ApiError. Unknown errors keep their message under `internal`. */
export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e
  const msg = e instanceof Error ? e.message : String(e)
  if (msg.includes('UNIQUE constraint failed')) {
    const hit = uniqueCodes.find(([cols]) => msg.includes(cols))
    if (hit) return new ApiError(hit[1])
  }
  const code = msg.match(/[a-z]+(?:_[a-z]+)+/g)?.find((w) => dbCodes.has(w))
  return code ? new ApiError(code) : new ApiError('internal', msg)
}
