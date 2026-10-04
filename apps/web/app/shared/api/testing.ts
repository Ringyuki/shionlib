import type { HttpMethod } from 'openapi-typescript-helpers'
import { createApi, type ApiClient } from './client'
import type { ApiData, ApiFailure, ApiPath } from './types'

type Handler = (request: Request) => Response | Promise<Response>

type Route = { method: string; pattern: RegExp; handler: Handler }

export type FakeApi = {
  api: ApiClient
  requests: Request[]
  on: <Method extends HttpMethod, Path extends ApiPath<Method>>(
    method: Method,
    path: Path,
    data: ApiData<Path, Method>,
  ) => FakeApi
  fail: <Method extends HttpMethod, Path extends ApiPath<Method>>(
    method: Method,
    path: Path,
    status: number,
    failure: Pick<ApiFailure, 'code' | 'message'>,
  ) => FakeApi
}

const baseUrl = 'http://api.test'

export function fakeApi(): FakeApi {
  const routes: Route[] = []
  const requests: Request[] = []
  const register = (method: string, path: string, handler: Handler) => {
    const pattern = new RegExp(`^${path.replace(/\{[^}]+\}/g, '[^/]+')}$`)
    routes.push({ method: method.toUpperCase(), pattern, handler })
  }
  const fetch = async (request: Request) => {
    requests.push(request.clone())
    const path = new URL(request.url).pathname
    const route = routes.find(entry => entry.method === request.method && entry.pattern.test(path))
    if (route === undefined) {
      return envelope(404, { code: 404, message: `no fake for ${request.method} ${path}` })
    }
    return route.handler(request)
  }
  const fake: FakeApi = {
    api: createApi({ baseUrl, fetch }),
    requests,
    on(method, path, data) {
      register(method, path, () => envelope(200, { code: 0, message: '', data }))
      return fake
    },
    fail(method, path, status, failure) {
      register(method, path, () => envelope(status, { ...failure, data: { errors: null } }))
      return fake
    },
  }
  return fake
}

function envelope(status: number, body: object): Response {
  return new Response(
    JSON.stringify({ requestId: 'test', timestamp: '2026-01-01T00:00:00.000Z', ...body }),
    { status, headers: { 'content-type': 'application/json' } },
  )
}
