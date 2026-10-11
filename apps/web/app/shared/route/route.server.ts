import { data, type RouterContextProvider } from 'react-router'
import * as v from 'valibot'
import type { ApiClient } from '~/shared/api/client'
import { ApiError } from '~/shared/api/error'
import { apiFrom } from './api.server'

type RouteArgs = { context: Readonly<RouterContextProvider> }

export async function routeLoader<Result>(
  { context }: RouteArgs,
  run: (api: ApiClient) => Promise<Result>,
): Promise<Result> {
  try {
    return await run(apiFrom(context))
  } catch (error) {
    if (error instanceof ApiError) {
      throw data(error.failure, { status: error.status })
    }
    throw error
  }
}

export function routeAction<Result>(args: RouteArgs, run: (api: ApiClient) => Promise<Result>) {
  return outcomeOf(args, run)
}

export function routeLazyLoader<Result>(args: RouteArgs, run: (api: ApiClient) => Promise<Result>) {
  return outcomeOf(args, run)
}

async function outcomeOf<Result>({ context }: RouteArgs, run: (api: ApiClient) => Promise<Result>) {
  try {
    return { ok: true as const, result: await run(apiFrom(context)) }
  } catch (error) {
    if (error instanceof ApiError) {
      return data(
        {
          ok: false as const,
          failure: error.failure,
          retryAfter: error.retryAfter,
          status: error.status,
        },
        { status: error.status },
      )
    }
    throw error
  }
}

const fileHeaders = [
  'content-type',
  'cache-control',
  'x-content-type-options',
  'content-security-policy',
]

export async function routeFile(
  { context }: RouteArgs,
  run: (api: ApiClient) => Promise<Response>,
): Promise<Response> {
  try {
    const answer = await run(apiFrom(context))
    const headers = new Headers()
    for (const name of fileHeaders) {
      const value = answer.headers.get(name)
      if (value !== null) {
        headers.set(name, value)
      }
    }
    return new Response(answer.body, { headers })
  } catch (error) {
    if (error instanceof ApiError) {
      throw data(null, { status: error.status })
    }
    throw error
  }
}

export async function readCommand<Schema extends v.GenericSchema>(
  { request }: { request: Request },
  schema: Schema,
): Promise<v.InferOutput<Schema>> {
  const parsed = v.safeParse(schema, await request.json().catch(() => undefined))
  if (!parsed.success) {
    throw data(null, { status: 400 })
  }
  return parsed.output
}

export async function readForm<Schema extends v.GenericSchema>(
  { request }: { request: Request },
  schema: Schema,
): Promise<v.InferOutput<Schema>> {
  const form = await request.formData().catch(() => undefined)
  const parsed = v.safeParse(schema, form === undefined ? undefined : Object.fromEntries(form))
  if (!parsed.success) {
    throw data(null, { status: 400 })
  }
  return parsed.output
}
