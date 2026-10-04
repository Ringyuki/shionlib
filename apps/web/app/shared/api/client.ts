import createClient, { type MaybeOptionalInit } from 'openapi-fetch'
import type { HttpMethod, RequiredKeysOf } from 'openapi-typescript-helpers'
import { ApiError } from './error'
import type { paths } from './generated/openapi'
import type { ApiData, ApiPath } from './types'

type Init<Path extends ApiPath<Method>, Method extends HttpMethod> = MaybeOptionalInit<
  paths[Path],
  Method
>

type InitArgs<I> = RequiredKeysOf<I> extends never ? [init?: I] : [init: I]

type Call<Method extends HttpMethod> = <Path extends ApiPath<Method>, I extends Init<Path, Method>>(
  path: Path,
  ...init: InitArgs<I>
) => Promise<ApiData<Path, Method>>

export type ApiClient = {
  get: Call<'get'>
  post: Call<'post'>
  put: Call<'put'>
  patch: Call<'patch'>
  delete: Call<'delete'>
}

export type ApiOptions = {
  baseUrl: string
  fetch?: (request: Request) => Promise<Response>
}

type LooseRequest = (
  method: HttpMethod,
  path: string,
  init?: object,
) => Promise<{ data?: { data?: unknown }; error?: unknown; response: Response }>

export function createApi(options: ApiOptions): ApiClient {
  const client = createClient<paths>({ baseUrl: options.baseUrl, fetch: options.fetch })
  const request = client.request as LooseRequest
  const send = async (method: HttpMethod, path: string, init?: object) => {
    const { data, error, response } = await request(method, path, init)
    if (error !== undefined || !response.ok) {
      throw ApiError.fromResponse(response, error)
    }
    return data?.data
  }
  const call = <Method extends HttpMethod>(method: Method) =>
    ((path: string, init?: object) => send(method, path, init)) as Call<Method>
  return {
    get: call('get'),
    post: call('post'),
    put: call('put'),
    patch: call('patch'),
    delete: call('delete'),
  }
}
