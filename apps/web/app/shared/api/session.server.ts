import { BusinessCode } from './generated/business-codes'
import { isFailure } from './error'

export const accessTokenCookie = 'shionlib_access_token'
export const refreshTokenCookie = 'shionlib_refresh_token'
export const authStaleHeader = 'shionlib-auth-stale'

const forwardedHeaders = ['user-agent', 'accept-language', 'x-forwarded-for', 'x-real-ip']
const refreshCodes: number[] = [BusinessCode.AUTH_UNAUTHORIZED, BusinessCode.AUTH_INVALID_TOKEN]
const refreshLeewaySeconds = 30

export type ApiSession = {
  fetch: (request: Request) => Promise<Response>
  prepare: () => Promise<void>
  issuedCookies: () => readonly string[]
}

export type ApiSessionOptions = {
  fetch?: (request: Request) => Promise<Response>
  now?: () => number
}

export function createApiSession(
  incoming: Request,
  apiUrl: string,
  { fetch = globalThis.fetch, now = Date.now }: ApiSessionOptions = {},
): ApiSession {
  const cookies = new CookieJar(incoming.headers.get('cookie') ?? '')
  const issued: string[] = []
  let refreshing: Promise<boolean> | undefined

  const decorate = (headers: Headers) => {
    for (const name of forwardedHeaders) {
      const value = incoming.headers.get(name)
      if (value !== null && !headers.has(name)) {
        headers.set(name, value)
      }
    }
    const cookie = cookies.header()
    if (cookie === '') {
      headers.delete('cookie')
    } else {
      headers.set('cookie', cookie)
    }
    return headers
  }

  const send = (request: Request) => {
    const headers = decorate(new Headers(request.headers))
    return fetch(new Request(request, { headers }))
  }

  const refresh = () => {
    refreshing ??= (async () => {
      if (!cookies.has(refreshTokenCookie)) {
        return false
      }
      const response = await fetch(
        new Request(`${apiUrl}/auth/token/refresh`, {
          method: 'POST',
          headers: decorate(new Headers()),
        }),
      )
      if (response.ok) {
        const setCookies = response.headers.getSetCookie()
        issued.push(...setCookies)
        cookies.apply(setCookies)
        return true
      }
      if (response.status === 401 || response.status === 403) {
        const cleared = [accessTokenCookie, refreshTokenCookie].map(expiredCookie)
        issued.push(...cleared)
        cookies.apply(cleared)
      }
      return false
    })()
    return refreshing
  }

  const needsRefresh = async (response: Response) => {
    if (response.headers.get(authStaleHeader) === '1') {
      return true
    }
    if (response.status !== 401) {
      return false
    }
    const body: unknown = await response
      .clone()
      .json()
      .catch(() => undefined)
    return isFailure(body) && refreshCodes.includes(body.code)
  }

  return {
    async fetch(request) {
      const retry = request.clone()
      const response = await send(request)
      if ((await needsRefresh(response)) && (await refresh())) {
        return send(retry)
      }
      return response
    },
    async prepare() {
      const access = cookies.get(accessTokenCookie)
      if (
        cookies.has(refreshTokenCookie) &&
        !tokenOutlives(access, now() / 1000 + refreshLeewaySeconds)
      ) {
        await refresh()
      }
    },
    issuedCookies: () => issued,
  }
}

function expiredCookie(name: string): string {
  return `${name}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`
}

function tokenOutlives(token: string | undefined, instant: number): boolean {
  const payload = token?.split('.')[1]
  if (payload === undefined) {
    return false
  }
  try {
    const claims: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return (
      typeof claims === 'object' &&
      claims !== null &&
      'exp' in claims &&
      typeof claims.exp === 'number' &&
      claims.exp > instant
    )
  } catch {
    return false
  }
}

class CookieJar {
  private readonly values = new Map<string, string>()

  constructor(header: string) {
    for (const part of header.split(';')) {
      const separator = part.indexOf('=')
      if (separator > 0) {
        this.values.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim())
      }
    }
  }

  get(name: string): string | undefined {
    return this.values.get(name)
  }

  has(name: string): boolean {
    return (this.values.get(name) ?? '') !== ''
  }

  apply(setCookies: readonly string[]) {
    for (const setCookie of setCookies) {
      const [pair = '', ...attributes] = setCookie.split(';')
      const separator = pair.indexOf('=')
      if (separator <= 0) {
        continue
      }
      const name = pair.slice(0, separator).trim()
      const expired = attributes.some(attribute => /^\s*max-age\s*=\s*0\s*$/i.test(attribute))
      if (expired) {
        this.values.delete(name)
      } else {
        this.values.set(name, pair.slice(separator + 1).trim())
      }
    }
  }

  header(): string {
    return [...this.values].map(([name, value]) => `${name}=${value}`).join('; ')
  }
}
