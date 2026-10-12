// Backup and restore: Rust commands (src-tauri/src/backup.rs) and the system file dialogs.
// In the plain-browser dev mode the Vite plugin (scripts/dev-db.ts) does the same: a download and an upload.
import { invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import { migrations } from '../tauri-db.ts'
import { today } from './amount.ts'
import { ApiError } from './api.ts'

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

/** Posts to the dev bridge; its error text is a bare code like `not_a_backup`. */
async function dev(body: object): Promise<Response> {
  const res = await fetch('/__db', { method: 'POST', body: JSON.stringify(body) })
  if (!res.ok) {
    const text = await res.text()
    throw new ApiError(/^[a-z_]+$/.test(text) ? text : 'file_error', text)
  }
  return res
}

/** Asks where, then writes a copy of the database (a download in the browser). Null when the user cancels. */
export async function backupAs(): Promise<string | null> {
  const name = `aa-finance-${today()}.sqlite`
  if (!inApp) {
    const blob = await (await dev({ op: 'backup' })).blob()
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name })
    a.click()
    URL.revokeObjectURL(a.href)
    return name
  }
  const path = await save({ defaultPath: name, filters: [{ name: 'SQLite', extensions: ['sqlite'] }] })
  if (!path) return null
  await cmd('backup_to', { path })
  return path
}

/** Asks the user for a backup file. Null when they cancel (browser only). */
const pickFile = () =>
  new Promise<File | null>((resolve) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.sqlite,.db' })
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.oncancel = () => resolve(null)
    input.click()
  })

/**
 * Asks for a backup file and replaces the data with it; the current data is saved to the backup
 * folder first. Reloads the app on success. False when the user cancels.
 */
export async function restore(): Promise<boolean> {
  if (inApp) {
    const path = await open({ multiple: false, directory: false, filters: [{ name: 'SQLite', extensions: ['sqlite', 'db'] }] })
    if (!path) return false
    await cmd('restore_from', { path, stamp: stamp(), maxVersion: migrations.length })
  } else {
    const file = await pickFile()
    if (!file) return false
    const bytes = new Uint8Array(await file.arrayBuffer())
    let bin = ''
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    await dev({ op: 'restore', file: btoa(bin) })
  }
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
