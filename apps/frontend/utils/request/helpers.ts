import { ServerRequestContext } from './types'
import { BasicResponse } from '@/interfaces/api/shionlib-api-res.interface'

export const isBrowser = typeof window !== 'undefined'
const JWT_SECTION_REGEX = /^[A-Za-z0-9\-_]+$/

export const getCookieValueFromHeader = (cookieHeader: string, name: string) => {
  if (!cookieHeader) return undefined
  const segments = cookieHeader.split(';')
  for (const segment of segments) {
    const [rawName, ...rest] = segment.trim().split('=')
    if (rawName === name) return rest.join('=')
  }
  return undefined
}

export const parseCookieHeader = (cookieHeader: string): Map<string, string> => {
  const jar = new Map<string, string>()
  if (!cookieHeader) return jar
  for (const segment of cookieHeader.split(';')) {
    const [rawName, ...rest] = segment.trim().split('=')
    if (!rawName) continue
    jar.set(rawName, rest.join('='))
  }
  return jar
}

export const shouldDeleteCookieFromSetCookie = (setCookie: string, value: string) => {
  if (value) return false
  const lower = setCookie.toLowerCase()
  return lower.includes('max-age=0') || lower.includes('expires=thu, 01 jan 1970')
}

export const applySetCookiesToCookieHeader = (cookieHeader: string, setCookies: string[]) => {
  const jar = parseCookieHeader(cookieHeader)
  for (const setCookie of setCookies) {
    const firstPair = setCookie.split(';')[0]?.trim()
    if (!firstPair) continue
    const eqIndex = firstPair.indexOf('=')
    if (eqIndex <= 0) continue
    const name = firstPair.slice(0, eqIndex)
    const value = firstPair.slice(eqIndex + 1)
    if (shouldDeleteCookieFromSetCookie(setCookie, value)) {
      jar.delete(name)
      continue
    }
    jar.set(name, value)
  }
  return Array.from(jar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ')
}

export const extractSetCookies = (headers: Headers): string[] => {
  const headerAny = headers as Headers & { getSetCookie?: () => string[] }
  if (typeof headerAny.getSetCookie === 'function') {
    const values = headerAny.getSetCookie()
    if (values.length > 0) return values
  }
  const single = headers.get('set-cookie')
  return single ? [single] : []
}

export const getServerRequestContext = async (): Promise<ServerRequestContext | null> => {
  if (isBrowser) return null
  const { cookies, headers: nextHeaders } = await import('next/headers')
  const incoming = await nextHeaders()
  return {
    cookieHeader: (await cookies()).toString(),
    realIp:
      incoming.get('cf-connecting-ip') || incoming.get('x-forwarded-for')?.split(',')[0]?.trim(),
    userAgent: incoming.get('user-agent') || undefined,
  }
}

export const resolveRefreshLockKey = (context?: Pick<ServerRequestContext, 'cookieHeader'>) => {
  if (isBrowser) return 'browser'
  const refreshToken = getCookieValueFromHeader(
    context?.cookieHeader || '',
    'shionlib_refresh_token',
  )
  return refreshToken ? `server:${refreshToken.slice(0, 48)}` : 'server:anonymous'
}

export const hasOptionalTokenStaleSignal = <T>(data: BasicResponse<T>, headers: Headers) => {
  const staleByMeta = data.meta?.auth?.optionalTokenStale === true
  const staleByHeader = headers.get('shionlib-auth-stale') === '1'
  return staleByMeta || staleByHeader
}

const decodeJwtSection = (section: string): Record<string, unknown> | null => {
  if (!section || !JWT_SECTION_REGEX.test(section)) return null
  try {
    const normalized = section.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const decoded =
      typeof atob === 'function' ? atob(padded) : Buffer.from(padded, 'base64').toString('utf8')
    return JSON.parse(decoded) as Record<string, unknown>
  } catch {
    return null
  }
}

export const decodeJwtLike = (
  token?: string,
): { header: Record<string, unknown>; payload: Record<string, unknown> } | null => {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const header = decodeJwtSection(parts[0] || '')
  const payload = decodeJwtSection(parts[1] || '')
  if (!header || !payload) return null
  return { header, payload }
}

export const shouldPreRefreshServerCookie = (
  cookieHeader: string,
  leewayMs = 5 * 1000,
): boolean => {
  const refreshToken = getCookieValueFromHeader(cookieHeader, 'shionlib_refresh_token')
  if (!refreshToken) return false

  const accessToken = getCookieValueFromHeader(cookieHeader, 'shionlib_access_token')
  if (!accessToken) return true

  const decoded = decodeJwtLike(accessToken)
  if (!decoded) return true
  const exp = decoded.payload.exp
  if (typeof exp !== 'number') return true
  return exp * 1000 - Date.now() <= leewayMs
}
