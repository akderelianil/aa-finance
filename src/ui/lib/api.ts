// The UI's only door to data: the core API on the app's Db, wrapped in TanStack Query.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { track } from './notify.ts'
import { ApiError, createApi, type Input, type OpName, type Output } from '../../core/api/index.ts'
import type { Db } from '../../core/db.ts'
import { migrate } from '../../core/migrate.ts'
import { devDb } from '../dev-db.ts'
import { migrations, tauriDb } from '../tauri-db.ts'

// Tauri in the app; the dev HTTP bridge in a plain browser (Vite dev only).
const db: Db = '__TAURI_INTERNALS__' in window || !import.meta.env.DEV ? tauriDb : devDb
const MEMBER_KEY = 'aa-finance.member'
export const lastMember = () => { try { return Number(localStorage.getItem(MEMBER_KEY)) || null } catch { return null } }
const api = createApi(db, lastMember())

/** Act as this member from the next call; kept on this device. */
export function setMember(id: number) {
  try { localStorage.setItem(MEMBER_KEY, String(id)) } catch { /* private window: this session only */ }
  api.use(id)
}

/** Runs the migrations once, before the first call. */
export const ready = migrate(db, migrations)

export async function call<K extends OpName>(op: K, input: Input<K>): Promise<Output<K>> {
  await ready
  return api.call(op, input)
}

/** A read op as a query. The key is the op and its input. `keep` shows the old data while a new page loads. */
export function useOp<K extends OpName>(op: K, input: Input<K>, opts: { enabled?: boolean; keep?: boolean } = {}) {
  return useQuery({
    queryKey: [op, input],
    queryFn: () => call(op, input),
    enabled: opts.enabled,
    placeholderData: opts.keep ? keepPreviousData : undefined,
  })
}

/** A write op. Any success refetches every query: reads are local and cheap. A toast shows it running, done or failed. */
export function useWrite<K extends OpName>(op: K) {
  const qc = useQueryClient()
  const { t } = useTranslation()
  const errorText = useErrorText()
  return useMutation({
    mutationFn: (input: Input<K>) =>
      track(call(op, input), {
        pending: t(`ops.${op}.pending` as never),
        done: t(`ops.${op}.done` as never),
        error: errorText,
      }),
    onSuccess: () => qc.invalidateQueries(),
  })
}

/** An error as a message in the current language. */
export function useErrorText() {
  const { t, i18n } = useTranslation()
  return (e: unknown): string => {
    const code = e instanceof ApiError ? e.code : 'internal'
    return i18n.exists(`errors.${code}`) ? t(`errors.${code}` as 'errors.internal') : t('errors.internal')
  }
}

export { ApiError }
