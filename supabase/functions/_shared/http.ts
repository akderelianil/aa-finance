import { createClient } from 'npm:@supabase/supabase-js@2.117.2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export class HttpError extends Error {
  constructor(public status: number, message: string, public code = 'error') {
    super(message)
  }
}

export type AuthUser = { id: string }

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function authenticate(req: Request): Promise<AuthUser> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) throw new HttpError(401, 'Giriş gerekli', 'unauthorized')
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, 'Oturum geçersiz', 'unauthorized')
  return { id: data.user.id }
}

export function serve(
  handler: (req: Request, user: AuthUser) => Promise<unknown>,
  successStatus = 200,
) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
    try {
      const user = await authenticate(req)
      return json(await handler(req, user), successStatus)
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.code, message: err.message }, err.status)
      const e = err as { code?: string; constraint_name?: string }
      if (e.code === '23505' && e.constraint_name === 'members_one_group_per_user') {
        return json({ error: 'already_member', message: 'Zaten bir gruba üyesin' }, 409)
      }
      console.error(err)
      return json({ error: 'internal', message: 'Beklenmeyen bir hata oluştu' }, 500)
    }
  })
}

export async function readBody(req: Request): Promise<Record<string, unknown>> {
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Geçersiz istek', 'bad_request')
  return body as Record<string, unknown>
}

export function requireString(v: unknown, field: string, max = 80): string {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s || s.length > max) throw new HttpError(422, `${field} geçersiz`, 'invalid_' + field)
  return s
}

export function requireDate(v: unknown, field: string): string {
  const s = typeof v === 'string' ? v : ''
  const d = new Date(s + 'T00:00:00Z')
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(d.getTime()) && d.toISOString().startsWith(s)
  if (!valid || s < '1900-01-01' || d.getTime() > Date.now()) {
    throw new HttpError(422, `${field} geçersiz`, 'invalid_' + field)
  }
  return s
}
