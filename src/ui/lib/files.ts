// Backup, restore and export: Rust commands (src-tauri/src/backup.rs) and the system file dialogs.
// In the plain-browser dev mode only the JSON export works (as a download).
import { invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import { migrations } from '../tauri-db.ts'
import { today } from './amount.ts'
import { ApiError, call } from './api.ts'

export const inApp = '__TAURI_INTERNALS__' in window

/** A Rust command; its error string becomes an ApiError (a bare code like `not_a_backup`, else `file_error`). */
async function cmd<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(name, args)
  } catch (e) {
    throw new ApiError(typeof e === 'string' && /^[a-z_]+$/.test(e) ? e : 'file_error', e)
  }
}

const stamp = () => new Date().toISOString().replace(/\D/g, '').slice(0, 14)

/** Today's automatic backup, once per day (the last 10 days are kept). */
export async function autoBackup() {
  if (inApp) await cmd('backup_auto', { day: today() })
}

export const backupDir = () => cmd<string>('backup_dir')

/** Asks where, then writes a copy of the database. Null when the user cancels. */
export async function backupAs(): Promise<string | null> {
  const path = await save({ defaultPath: `aa-finance-${today()}.sqlite`, filters: [{ name: 'SQLite', extensions: ['sqlite'] }] })
  if (!path) return null
  await cmd('backup_to', { path })
  return path
}

/**
 * Asks for a backup file and replaces the data with it; the current data is saved to the backup
 * folder first. Reloads the app on success. False when the user cancels.
 */
export async function restore(): Promise<boolean> {
  const path = await open({ multiple: false, directory: false, filters: [{ name: 'SQLite', extensions: ['sqlite', 'db'] }] })
  if (!path) return false
  await cmd('restore_from', { path, stamp: stamp(), maxVersion: migrations.length })
  location.reload()
  return true
}

/** Deletes the whole book (the app copies it to the backup folder first) and reloads into setup. */
export async function resetAll(): Promise<boolean> {
  if (inApp) await cmd('reset_data', { stamp: stamp() })
  else {
    // Plain-browser dev mode: the Vite plugin in scripts/dev-db.ts drops the dev database (no copy).
    const res = await fetch('/__db', { method: 'POST', body: JSON.stringify({ op: 'reset' }) })
    if (!res.ok) throw new ApiError('file_error', await res.text())
  }
  location.reload()
  return true
}

/** All data as one JSON file. Null when the user cancels. */
export async function exportJson(): Promise<string | null> {
  const text = JSON.stringify(await call('data.export', {}), null, 2)
  const name = `aa-finance-${today()}.json`
  if (!inApp) {
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: name })
    a.click()
    URL.revokeObjectURL(a.href)
    return name
  }
  const path = await save({ defaultPath: name, filters: [{ name: 'JSON', extensions: ['json'] }] })
  if (!path) return null
  await cmd('write_text', { path, text })
  return path
}
