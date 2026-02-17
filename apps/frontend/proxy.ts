import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'
import { NextRequest } from 'next/server'

const intl = createMiddleware(routing)
const ACCESS_REFRESH_LEEWAY_MS = 60 * 1000
const JWT_SECTION_REGEX = /^[A-Za-z0-9\-_]+$/

const decodeJwtSection = (section: string): Record<string, unknown> | null => {
  if (!section || !JWT_SECTION_REGEX.test(section)) return null
  try {
    const normalized = section.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    return JSON.parse(atob(padded)) as Record<string, unknown>
  } catch {
    return null
  }
}

const parseJwt = (token: string) => {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const header = decodeJwtSection(parts[0] || '')
  const payload = decodeJwtSection(parts[1] || '')
  if (!header || !payload) return null
  return { header, payload }
}

const shouldRefreshInProxy = (accessToken?: string, refreshToken?: string) => {
  if (!refreshToken) return false
  if (!accessToken) return true
  const parsed = parseJwt(accessToken)
  if (!parsed) return true
  const exp = parsed.payload.exp
  if (typeof exp !== 'number') return true
  const expMs = exp * 1000
  return expMs - Date.now() <= ACCESS_REFRESH_LEEWAY_MS
}

const extractSetCookies = (headers: Headers): string[] => {
  const headerAny = headers as Headers & { getSetCookie?: () => string[] }
  if (typeof headerAny.getSetCookie === 'function') {
    const values = headerAny.getSetCookie()
    if (values.length > 0) return values
  }
  const single = headers.get('set-cookie')
  return single ? [single] : []
}

export default async function proxy(req: NextRequest) {
  const token = req.cookies.get('shionlib_access_token')?.value
  const refresh_token = req.cookies.get('shionlib_refresh_token')?.value
  let refreshedSetCookies: string[] = []
  if (shouldRefreshInProxy(token, refresh_token)) {
    try {
      const refreshUrl = new URL('/api/auth/token/refresh', req.url)
      const refreshResp = await fetch(refreshUrl.toString(), {
        method: 'POST',
        headers: { cookie: req.headers.get('cookie') || '' },
      })
      if (refreshResp.ok) {
        refreshedSetCookies = extractSetCookies(refreshResp.headers)
      }
    } catch {}
  }

  const handled = intl(req)
  if (refreshedSetCookies.length > 0) {
    for (const cookie of refreshedSetCookies) {
      handled.headers.append('Set-Cookie', cookie)
    }
  }
  return handled
}

export const config = {
  // Match all pathnames except for
  // - … if they start with `/api`, `/trpc`, `/_next` or `/_vercel`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: '/((?!api|trpc|_next|_vercel|og|patch|.*\\..*).*)',
}
