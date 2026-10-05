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

export async function routeAction<Result>(
  { context }: RouteArgs,
  run: (api: ApiClient) => Promise<Result>,
) {
  try {
    return { ok: true as const, result: await run(apiFrom(context)) }
  } catch (error) {
    if (error instanceof ApiError) {
      return data({ ok: false as const, failure: error.failure }, { status: error.status })
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
