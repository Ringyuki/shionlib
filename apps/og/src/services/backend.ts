import { z } from 'zod'
import { config } from '@/config'

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class BackendError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'BackendError'
  }
}

const METADATA_TTL_MS = 10 * 60 * 1000
const REQUEST_TIMEOUT_MS = 5000

type Entry = { data: unknown; expiresAt: number }

const cache = new Map<string, Entry>()

export function clearBackendCache(): void {
  cache.clear()
}

const envelope = z.object({ data: z.unknown() })

export async function fetchData<T extends z.ZodType>(
  path: string,
  schema: T,
): Promise<z.output<T>> {
  const cached = config.OG_CACHE_DISABLED ? undefined : cache.get(path)
  if (cached && cached.expiresAt > Date.now()) {
    return schema.parse(cached.data)
  }
  const data = await request(path)
  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    throw new BackendError(502, `Unexpected response from ${path}: ${parsed.error.message}`)
  }
  if (!config.OG_CACHE_DISABLED) {
    cache.set(path, { data, expiresAt: Date.now() + METADATA_TTL_MS })
  }
  return parsed.data
}

async function request(path: string): Promise<unknown> {
  let res: Response
  try {
    res = await fetch(`${config.BACKEND_INTERNAL_URL}${path}`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new BackendError(504, `Backend request timed out: ${path}`)
    }
    throw new BackendError(502, `Backend unreachable: ${path}`)
  }
  if (res.status === 404) {
    throw new NotFoundError(`Not found: ${path}`)
  }
  if (!res.ok) {
    throw new BackendError(res.status, `Backend returned ${res.status}: ${path}`)
  }
  return envelope.parse(await res.json()).data
}
