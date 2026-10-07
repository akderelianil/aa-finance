// UUID v7: 48-bit unix ms zaman damgası + rastgele.
export function uuidv7(): string {
  const ts = BigInt(Date.now())
  const rnd = crypto.getRandomValues(new Uint8Array(10))
  const b = new Uint8Array(16)
  for (let i = 0; i < 6; i++) b[i] = Number((ts >> BigInt(8 * (5 - i))) & 0xffn)
  b[6] = 0x70 | (rnd[0] & 0x0f)
  b[7] = rnd[1]
  b[8] = 0x80 | (rnd[2] & 0x3f)
  b.set(rnd.slice(3, 10), 9)
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
