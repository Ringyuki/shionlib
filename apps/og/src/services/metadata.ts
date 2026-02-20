import { config, LOCALE_TO_DATA_LANG, type SupportedLocale } from '@/config'
import {
  getGameOgData,
  getCharacterOgData,
  getDeveloperOgData,
  normaliseIntro,
  type GameOgSource,
  type CharacterOgSource,
  type DeveloperOgSource,
  type GameOgData,
  type CharacterOgData,
  type DeveloperOgData,
} from '@/utils/preferred-content'

// ─── Errors ──────────────────────────────────────────────────────────────────

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

// ─── In-memory metadata cache ─────────────────────────────────────────────────

const METADATA_TTL_MS = 10 * 60 * 1000 // 10 minutes

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const cache = new Map<string, CacheEntry<unknown>>()

function cacheGet<T>(key: string): T | null {
  if (config.OG_CACHE_DISABLED) return null
  const entry = cache.get(key) as CacheEntry<T> | undefined
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  return entry.data
}

function cacheSet<T>(key: string, data: T): void {
  if (config.OG_CACHE_DISABLED) return
  cache.set(key, { data, expiresAt: Date.now() + METADATA_TTL_MS })
}

// ─── Fetcher ─────────────────────────────────────────────────────────────────

// Backend wraps all responses in { code, message, data, requestId, timestamp }
interface BackendEnvelope<T> {
  data: T
}

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (
    url.startsWith('http') ||
    url.startsWith('blob:') ||
    url.startsWith('data:image') ||
    url.includes('assets')
  ) {
    return url
  }

  const base = config.SHIONLIB_IMAGE_BED_URL.replace(/\/+$/, '')
  const path = url.startsWith('/') ? url : `/${url}`
  return `${base}${path}`
}

async function fetchFromBackend<T>(path: string): Promise<T> {
  const url = `${config.BACKEND_INTERNAL_URL}${path}`
  const signal = AbortSignal.timeout(5000)

  let res: Response
  try {
    res = await fetch(url, { signal })
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

  const envelope = (await res.json()) as BackendEnvelope<T>
  return envelope.data
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getGameMetadata(id: string, locale: SupportedLocale): Promise<GameOgData> {
  const cacheKey = `game:${id}:${locale}`
  const cached = cacheGet<GameOgData>(cacheKey)
  if (cached) return cached

  const raw = await fetchFromBackend<GameOgSource>(`/game/${id}`)
  const lang = LOCALE_TO_DATA_LANG[locale]
  const data = getGameOgData(raw, lang)
  data.intro = normaliseIntro(data.intro)
  data.coverUrl = resolveImageUrl(data.coverUrl)

  cacheSet(cacheKey, data)
  return data
}

export async function getCharacterMetadata(
  id: string,
  locale: SupportedLocale,
): Promise<CharacterOgData> {
  const cacheKey = `character:${id}:${locale}`
  const cached = cacheGet<CharacterOgData>(cacheKey)
  if (cached) return cached

  const raw = await fetchFromBackend<CharacterOgSource>(`/character/${id}`)
  const lang = LOCALE_TO_DATA_LANG[locale]
  const data = getCharacterOgData(raw, lang)
  data.intro = normaliseIntro(data.intro)
  data.imageUrl = resolveImageUrl(data.imageUrl)

  cacheSet(cacheKey, data)
  return data
}

export async function getDeveloperMetadata(
  id: string,
  locale: SupportedLocale,
): Promise<DeveloperOgData> {
  const cacheKey = `developer:${id}:${locale}`
  const cached = cacheGet<DeveloperOgData>(cacheKey)
  if (cached) return cached

  const raw = await fetchFromBackend<DeveloperOgSource>(`/developer/${id}`)
  const lang = LOCALE_TO_DATA_LANG[locale]
  const data = getDeveloperOgData(raw, lang)
  data.intro = normaliseIntro(data.intro)
  data.logoUrl = resolveImageUrl(data.logoUrl)

  cacheSet(cacheKey, data)
  return data
}
