import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'

export class ApiError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

// Edge Function çağrısı. Sunucu hataları { error: <kod>, message } olarak gelir; kod arayüzde çevrilir.
export async function callFunction<T>(name: string, body?: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body: body ?? {} })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const res = error.context as Response
      const payload = await res.json().catch(() => null)
      throw new ApiError(payload?.error ?? 'internal', payload?.message ?? error.message, res.status)
    }
    throw new ApiError('network', error.message, 0)
  }
  return data as T
}
