import { browserApiBase } from './browser'
import { createApi, type ApiClient } from './client'
import { asksForRefresh } from './session'
import type { ApiPath } from './types'
import { toResponse, xhrSend, type XhrRequest, type XhrResponse } from './xhr'

const refreshPath = '/auth/token/refresh' satisfies ApiPath<'post'>

let refreshing: Promise<boolean> | undefined

export function createBrowserApi(origin: string = location.origin): ApiClient {
  return createApi({ baseUrl: origin + browserApiBase, fetch: browserFetch })
}

export async function sendWithSession(request: XhrRequest): Promise<XhrResponse> {
  const response = await xhrSend(request)
  if (asksForRefresh(response.status, response.headers, jsonOf(response)) && (await refresh())) {
    return xhrSend(request)
  }
  return response
}

export function jsonOf(response: XhrResponse): unknown {
  try {
    return JSON.parse(response.text)
  } catch {
    return undefined
  }
}

async function browserFetch(request: Request): Promise<Response> {
  const body = request.body === null ? null : await request.blob()
  const response = await sendWithSession({
    method: request.method,
    url: request.url,
    headers: request.headers,
    body,
    signal: request.signal,
  })
  return toResponse(response)
}

function refresh(): Promise<boolean> {
  refreshing ??= xhrSend({ method: 'POST', url: `${browserApiBase}${refreshPath}` })
    .then(
      response => response.status >= 200 && response.status < 300,
      () => false,
    )
    .finally(() => {
      refreshing = undefined
    })
  return refreshing
}
