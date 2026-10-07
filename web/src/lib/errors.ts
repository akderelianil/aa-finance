import type { TFunction } from 'i18next'
import { AuthError } from '@supabase/supabase-js'
import { ApiError } from './api'

const AUTH_CODES: Record<string, string> = {
  invalid_credentials: 'invalidCredentials',
  email_not_confirmed: 'emailNotConfirmed',
  user_already_exists: 'userExists',
  weak_password: 'weakPassword',
}

export function errorMessage(t: TFunction, err: unknown): string {
  if (err instanceof ApiError) {
    return t(`errors.${err.code}`, { defaultValue: t('errors.generic') })
  }
  if (err instanceof AuthError) {
    const key = err.code ? AUTH_CODES[err.code] : undefined
    return key ? t(`errors.${key}`) : t('errors.generic')
  }
  return t('errors.generic')
}
