import { BasicResponse, ErrorResponse } from '@/interfaces/api/shionlib-api-res.interface'
import { ShionlibBizError } from '@/libs/errors'
import { SHOULD_REFRESH_CODES, IS_FATAL_AUTH_BY_CODES } from '@/constants/auth/auth-status-codes'
import { NOT_FOUND_CODES } from '@/constants/not-found-codes'
import { useShionlibUserStore } from '@/store/userStore'
import { RefreshResult, ServerRequestContext } from './types'
import {
  isBrowser,
  getServerRequestContext,
  applySetCookiesToCookieHeader,
  hasOptionalTokenStaleSignal,
  resolveRefreshLockKey,
  extractSetCookies,
  shouldPreRefreshServerCookie,
  buildHeaders,
  formatErrors,
} from './helpers'

let refreshPromises = new Map<string, Promise<RefreshResult>>()

const shouldRefresh = (code: number) => {
  return SHOULD_REFRESH_CODES.includes(code)
}
const isFatalAuthByCode = (code: number) => {
  return IS_FATAL_AUTH_BY_CODES.includes(code)
}

const normalizeBaseUrl = (url?: string) => (url ? url.replace(/\/+$/, '') : undefined)
const browserBaseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_PROD_API_PATH)
const serverBaseUrl =
  normalizeBaseUrl(process.env.INTERNAL_API_BASE_URL) ||
  (process.env.INTERNAL_API_PORT
    ? normalizeBaseUrl(`http://localhost:${process.env.INTERNAL_API_PORT}`)
    : undefined)

const baseUrl = isBrowser ? browserBaseUrl : serverBaseUrl
const SSR_PRE_REFRESH_LEEWAY_MS = 10 * 1000

export const shionlibRequest = ({
  forceThrowError = false,
  forceNotThrowError = false,
}: { forceThrowError?: boolean; forceNotThrowError?: boolean } = {}) => {
  const basicFetch = async <T>(
    path: string,
    options: RequestInit,
    params?: Record<string, any>,
  ): Promise<BasicResponse<T>> => {
    if (!baseUrl) {
      throw new Error('API base URL is not configured')
    }

    const serverContext = await getServerRequestContext()
    let serverCookieHeader = serverContext?.cookieHeader || ''

    const getRefreshContext = (): ServerRequestContext | undefined =>
      isBrowser
        ? undefined
        : {
            cookieHeader: serverCookieHeader,
            realIp: serverContext?.realIp,
            userAgent: serverContext?.userAgent,
          }

    const init = async (): Promise<RequestInit> => {
      const headers = new Headers(await buildHeaders(options))
      if (!isBrowser) {
        if (serverCookieHeader) headers.set('Cookie', serverCookieHeader)
        if (serverContext?.realIp) headers.set('x-real-ip', serverContext.realIp)
        if (serverContext?.userAgent) headers.set('user-agent', serverContext.userAgent)
      }
      // if body is FormData, we will not manually set Content-Type so browser can set boundary.
      const opt: RequestInit = { ...options, headers, credentials: 'include' }
      const maybeBody: any = (opt as any).body
      if (maybeBody instanceof FormData) {
        headers.delete('Content-Type')
      }
      return opt
    }
    const reqUrl = () =>
      `${baseUrl}${path}${params ? `?${new URLSearchParams(params).toString()}` : ''}`

    const requestOnce = async (): Promise<{ data: BasicResponse<T>; headers: Headers }> => {
      const opt = await init()
      const res = await fetch(reqUrl(), opt)
      const raw = await res.text()
      let data: BasicResponse<T> = {} as BasicResponse<T>
      if (raw) {
        try {
          data = JSON.parse(raw) as BasicResponse<T>
        } catch {
          const preview = raw.slice(0, 256).replace(/\s+/g, ' ').trim()
          throw new Error(
            `Invalid JSON response (${res.status}) from ${reqUrl()}: ${preview || '<empty body>'}`,
          )
        }
      }
      if (typeof data?.code !== 'number') {
        const preview = raw.slice(0, 256).replace(/\s+/g, ' ').trim()
        throw new Error(
          `Unexpected API response (${res.status}) from ${reqUrl()}: ${preview || '<empty body>'}`,
        )
      }

      const headers = res.headers
      return { data, headers }
    }

    const refreshAndRetry = async () => {
      if (!baseUrl) return null
      const refreshResult = await doRefresh(baseUrl, getRefreshContext())
      if (!isBrowser && refreshResult.setCookies.length > 0) {
        serverCookieHeader = applySetCookiesToCookieHeader(
          serverCookieHeader,
          refreshResult.setCookies,
        )
      }
      return requestOnce()
    }

    const tryPreRefreshForServerRequest = async () => {
      if (isBrowser || !baseUrl) return
      if (!shouldPreRefreshServerCookie(serverCookieHeader, SSR_PRE_REFRESH_LEEWAY_MS)) return
      try {
        const refreshResult = await doRefresh(baseUrl, getRefreshContext())
        if (refreshResult.setCookies.length > 0) {
          serverCookieHeader = applySetCookiesToCookieHeader(
            serverCookieHeader,
            refreshResult.setCookies,
          )
        }
      } catch {
        // continue with original request path: optional endpoints can still degrade to guest
      }
    }

    let rht
    let sileo
    if (isBrowser) {
      // rht = await import('react-hot-toast')
      rht = { toast: { error: (message: string) => {} } }
      sileo = await import('sileo')
    }

    await tryPreRefreshForServerRequest()

    let { data, headers } = await requestOnce()
    if (data && data.code === 0 && hasOptionalTokenStaleSignal(data, headers)) {
      try {
        const retried = await refreshAndRetry()
        if (retried?.data?.code === 0) {
          return retried.data
        }
      } catch {
        return data
      }
      return data
    }

    if (data && data.code === 0) return data

    if (isFatalAuthByCode(data.code)) {
      if (rht) rht.toast.error(data.message)
      if (sileo) sileo.sileo.error({ title: data.message })
      await doLogout(baseUrl!, getRefreshContext())
      throw new ShionlibBizError(data.code, data.message)
    }
    if (shouldRefresh(data.code)) {
      try {
        const retried = await refreshAndRetry()
        if (retried) {
          data = retried.data
          headers = retried.headers
          if (retried.data.code === 0) return retried.data
        }
      } catch {
        if (forceNotThrowError) return data
        throw new ShionlibBizError(data.code, data.message)
      }
    }

    if (data.code !== 0) {
      if (forceNotThrowError) return data
      if (data.code <= 1000) {
        if (data.code === 429) {
          const retryAfter = headers.get('retry-after-download') || headers.get('retry-after')
          rht && rht.toast.error(formatErrors(data as ErrorResponse, retryAfter || undefined))
          sileo &&
            sileo.sileo.error({
              title: formatErrors(data as ErrorResponse, retryAfter || undefined),
            })
          throw new ShionlibBizError(data.code, data.message)
        } else if (data.code === 400) {
          throw new ShionlibBizError(data.code, data.message)
        } else {
          rht && rht.toast.error(formatErrors(data as ErrorResponse))
          sileo && sileo.sileo.error({ title: formatErrors(data as ErrorResponse) })
        }

        throw new Error(data.message)
      }
      rht && rht.toast.error(formatErrors(data as ErrorResponse))
      sileo && sileo.sileo.error({ title: formatErrors(data as ErrorResponse) })
      if (!NOT_FOUND_CODES.includes(data.code) || forceThrowError) {
        throw new ShionlibBizError(data.code, data.message)
      }
    }

    return data
  }

  const get = async <T>(
    path: string,
    config?: { params?: Record<string, any>; options?: RequestInit },
  ): Promise<BasicResponse<T>> => {
    return await basicFetch<T>(
      path,
      {
        method: 'GET',
        ...config?.options,
      },
      config?.params,
    )
  }
  const post = async <T>(
    path: string,
    config?: { data?: Record<string, any>; params?: Record<string, any>; options?: RequestInit },
  ): Promise<BasicResponse<T>> => {
    return await basicFetch<T>(
      path,
      {
        method: 'POST',
        body: config?.data ? JSON.stringify(config.data) : undefined,
        ...config?.options,
      },
      config?.params,
    )
  }
  const put = async <T>(
    path: string,
    config?: { data?: Record<string, any>; params?: Record<string, any>; options?: RequestInit },
  ): Promise<BasicResponse<T>> => {
    return await basicFetch<T>(
      path,
      {
        method: 'PUT',
        body: config?.data ? JSON.stringify(config.data) : undefined,
        ...config?.options,
      },
      config?.params,
    )
  }
  const _delete = async <T>(
    path: string,
    config?: { data?: Record<string, any>; params?: Record<string, any>; options?: RequestInit },
  ): Promise<BasicResponse<T>> => {
    return await basicFetch<T>(
      path,
      {
        method: 'DELETE',
        body: config?.data ? JSON.stringify(config.data) : undefined,
        ...config?.options,
      },
      config?.params,
    )
  }
  const patch = async <T>(
    path: string,
    config?: { data?: Record<string, any>; params?: Record<string, any>; options?: RequestInit },
  ): Promise<BasicResponse<T>> => {
    return await basicFetch<T>(
      path,
      {
        method: 'PATCH',
        body: config?.data ? JSON.stringify(config.data) : undefined,
        ...config?.options,
      },
      config?.params,
    )
  }

  const _fetch = async <T>(
    path: string,
    config?: {
      method: string
      data?: any
      params?: Record<string, any>
      options?: RequestInit
    },
  ): Promise<BasicResponse<T>> => {
    return await basicFetch<T>(
      path,
      {
        method: config?.method,
        body: config?.data,
        ...config?.options,
      },
      config?.params,
    )
  }

  return {
    get,
    post,
    put,
    delete: _delete,
    patch,
    fetch: _fetch,
  }
}

const doRefresh = async (
  baseUrl: string,
  context?: ServerRequestContext,
): Promise<RefreshResult> => {
  const refreshKey = resolveRefreshLockKey(context)
  const existing = refreshPromises.get(refreshKey)
  if (existing) return existing

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (!isBrowser) {
    if (context?.cookieHeader) headers.cookie = context.cookieHeader
    if (context?.realIp) headers['x-real-ip'] = context.realIp
    if (context?.userAgent) headers['user-agent'] = context.userAgent
  }

  const promise = fetch(`${baseUrl}/auth/token/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers,
  })
    .then(async res => {
      const data = await res.json().catch(() => ({}))
      if (!(res.ok && data && data.code === 0)) {
        if (isFatalAuthByCode(data.code)) {
          await doLogout(baseUrl, context)
          throw new ShionlibBizError(data.code, data.message)
        }
        throw new Error((data && data.message) || 'Token refresh failed')
      }
      return {
        setCookies: extractSetCookies(res.headers),
      }
    })
    .finally(() => {
      refreshPromises.delete(refreshKey)
    })

  refreshPromises.set(refreshKey, promise)
  return promise
}

const doLogout = async (baseUrl: string, context?: ServerRequestContext) => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (!isBrowser) {
    if (context?.cookieHeader) headers.cookie = context.cookieHeader
    if (context?.realIp) headers['x-real-ip'] = context.realIp
    if (context?.userAgent) headers['user-agent'] = context.userAgent
  }

  return fetch(`${baseUrl}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    headers,
  }).finally(async () => {
    refreshPromises = new Map<string, Promise<RefreshResult>>()
    if (isBrowser) {
      useShionlibUserStore.getState().logout(false)
    }
  })
}
