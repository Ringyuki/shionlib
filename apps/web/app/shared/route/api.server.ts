import { createContext, type MiddlewareFunction, type RouterContextProvider } from 'react-router'
import { createApi, type ApiClient } from '~/shared/api/client'
import { createApiSession } from '~/shared/api/session.server'
import { readServerEnv } from '~/shared/config/env.server'
import { isLocale } from '~/shared/i18n/locale.schema'

export const apiContext = createContext<ApiClient>()
const env = readServerEnv()

export const apiMiddleware: MiddlewareFunction<Response> = async (
  { request, context, params },
  next,
) => {
  const locale = isLocale(params.lang) ? params.lang : undefined
  const session = createApiSession(request, env.apiInternalUrl, { locale })
  await session.prepare()
  context.set(apiContext, createApi({ baseUrl: env.apiInternalUrl, fetch: session.fetch }))
  const response = await next()
  for (const cookie of session.issuedCookies()) {
    response.headers.append('Set-Cookie', cookie)
  }
  return response
}

export function apiFrom(context: Readonly<RouterContextProvider>): ApiClient {
  return context.get(apiContext)
}
