/**
 * This route is used to proxy requests to the Kungalgame Patch API.
 * Only used in development environment.
 */
import { NextRequest } from 'next/server'

const TARGET_BASE_URL = 'https://www.moyu.moe/api/hikari'
const SHIONLIB_ORIGIN = 'https://shionlib.com'

export const dynamic = 'force-dynamic'

interface RouteParams {
  path?: string[]
}
interface RouteContext {
  params: Promise<RouteParams>
}

const handler = async (request: NextRequest, context: RouteContext) => {
  try {
    const params = await context.params
    const targetUrl = buildTargetUrl(params?.path, request.nextUrl.search)
    const upstreamResponse = await fetch(targetUrl, {
      method: request.method,
      headers: buildForwardHeaders(request.headers),
      body: shouldForwardBody(request.method) ? request.body : undefined,
      redirect: 'manual',
    })

    const responseHeaders = sanitizeResponseHeaders(upstreamResponse.headers)
    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error('[patch-proxy] upstream request failed', error)
    return new Response('Upstream request failed', { status: 502 })
  }
}

export {
  handler as GET,
  handler as HEAD,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  handler as OPTIONS,
}

function buildTargetUrl(pathSegments: string[] | undefined, search: string) {
  const normalizedPath = pathSegments?.filter(Boolean).join('/') ?? ''
  const base = normalizedPath ? `${TARGET_BASE_URL}/${normalizedPath}` : TARGET_BASE_URL
  return search ? `${base}${search}` : base
}

function buildForwardHeaders(incomingHeaders: Headers) {
  const headers = new Headers(incomingHeaders)
  headers.set('Referer', SHIONLIB_ORIGIN)
  headers.set('Origin', SHIONLIB_ORIGIN)
  headers.delete('host')
  return headers
}

function shouldForwardBody(method: string) {
  return !['GET', 'HEAD'].includes(method.toUpperCase())
}

function sanitizeResponseHeaders(upstreamHeaders: Headers) {
  const headers = new Headers(upstreamHeaders)
  headers.delete('content-encoding')
  headers.delete('content-length')
  headers.delete('transfer-encoding')
  headers.delete('connection')
  return headers
}
