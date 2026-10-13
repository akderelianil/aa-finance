// PIN hashing: PBKDF2-SHA256 through WebCrypto (webview and Node). Pure; no UI or Tauri imports.
// App gate, not security: 6 digits are 1,000,000 values, so the hash can be brute-forced offline by anyone with the file.

/** Iterations for new hashes. Each row keeps its own count, so this can rise later. */
export const PIN_ITERATIONS = 200_000

const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
const fromHex = (h: string) => Uint8Array.from(h.match(/../g) ?? [], (x) => parseInt(x, 16))

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, 256)
  return toHex(new Uint8Array(bits))
}

export type PinHash = { hash: string; salt: string; iterations: number }

/** A new hash with a random 16-byte salt. */
export async function hashPin(pin: string, iterations = PIN_ITERATIONS): Promise<PinHash> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return { hash: await derive(pin, salt, iterations), salt: toHex(salt), iterations }
}

/** True when the PIN matches the stored hash. Compares every byte, no early exit. */
export async function verifyPin(pin: string, stored: PinHash): Promise<boolean> {
  const got = await derive(pin, fromHex(stored.salt), stored.iterations)
  let diff = got.length ^ stored.hash.length
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ (stored.hash.charCodeAt(i) || 0)
  return diff === 0
}
