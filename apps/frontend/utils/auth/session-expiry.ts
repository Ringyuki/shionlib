'use client'

import { AuthSessionPayload } from '@/interfaces/auth/auth-session.interface'

const AUTH_SESSION_EXPIRY_KEY = 'shionlib:auth-session-expiry'

export const isAuthSessionPayload = (value: unknown): value is AuthSessionPayload => {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  const isNullableString = (value: unknown): value is string | null =>
    value === null || typeof value === 'string'

  return (
    isNullableString(record.accessTokenExpiresAt) && isNullableString(record.refreshTokenExpiresAt)
  )
}

export const persistAuthSessionExpiry = (value: AuthSessionPayload) => {
  if (!isAuthSessionPayload(value)) return
  localStorage.setItem(
    AUTH_SESSION_EXPIRY_KEY,
    JSON.stringify({
      accessTokenExpiresAt: value.accessTokenExpiresAt ?? null,
      refreshTokenExpiresAt: value.refreshTokenExpiresAt ?? null,
    }),
  )
}

export const readAuthSessionExpiry = (): AuthSessionPayload | null => {
  const raw = localStorage.getItem(AUTH_SESSION_EXPIRY_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    if (!isAuthSessionPayload(parsed)) return null
    return {
      accessTokenExpiresAt: parsed.accessTokenExpiresAt ?? null,
      refreshTokenExpiresAt: parsed.refreshTokenExpiresAt ?? null,
    }
  } catch {
    return null
  }
}

export const clearAuthSessionExpiry = () => localStorage.removeItem(AUTH_SESSION_EXPIRY_KEY)

export const shouldRefreshAuthSession = (value?: AuthSessionPayload | null, leewayMs = 60_000) => {
  const expMs = value?.accessTokenExpiresAt ? Date.parse(value.accessTokenExpiresAt) : null
  if (expMs === null) return false
  return expMs - Date.now() <= leewayMs
}
