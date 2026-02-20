import { describe, expect, it, beforeEach, mock } from 'bun:test'

// Must be set before config module is imported
process.env.BACKEND_INTERNAL_URL = 'http://test-backend:5000'
process.env.REDIS_HOST = 'localhost'
process.env.OG_DESIGN_VERSION = '1'
process.env.OG_CACHE_DISABLED = 'false' // enable in-memory cache so cache-hit tests work

const { getGameMetadata, getCharacterMetadata, getDeveloperMetadata, NotFoundError, BackendError } =
  await import('../../src/services/metadata')
const { config } = await import('../../src/config')

// ─── Fetch mock ───────────────────────────────────────────────────────────────

const mockFetch = mock()
// @ts-ignore — replace global fetch with mock
global.fetch = mockFetch

function okResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => data,
  } as Response
}

function errorResponse(status: number): Response {
  return { ok: false, status, json: async () => ({}) } as Response
}

// ─── getGameMetadata ─────────────────────────────────────────────────────────

describe('getGameMetadata', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    config.OG_CACHE_DISABLED = false
  })

  it('fetches game and transforms data for the requested locale', async () => {
    mockFetch.mockResolvedValue(
      okResponse({
        data: {
          title_jp: 'タイトル',
          title_en: 'English Title',
          title_zh: '',
          intro_en: 'English intro text.',
          intro_jp: '',
          intro_zh: '',
          covers: [{ language: 'en', url: 'https://img/cover.webp', dims: [900, 600] }],
        },
      }),
    )

    const result = await getGameMetadata('game-en-1', 'en')

    expect(result.title).toBe('English Title')
    expect(result.intro).toBe('English intro text.')
    expect(result.coverUrl).toBe('https://img/cover.webp')
    expect(result.aspectRatio).toBe('3:2')
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url] = mockFetch.mock.calls[0] as [string]
    expect(url).toContain('/game/game-en-1')
  })

  it('uses ja→jp locale mapping for data field access', async () => {
    mockFetch.mockResolvedValue(
      okResponse({
        data: {
          title_jp: 'JP タイトル',
          title_en: '',
          title_zh: '',
          intro_jp: 'JP イントロ',
          intro_en: '',
          intro_zh: '',
        },
      }),
    )

    const result = await getGameMetadata('game-ja-1', 'ja')
    expect(result.title).toBe('JP タイトル')
    expect(result.intro).toBe('JP イントロ')
  })

  it('normalises intro (strips newlines)', async () => {
    mockFetch.mockResolvedValue(
      okResponse({
        data: {
          title_jp: 'T',
          title_en: 'T',
          title_zh: '',
          intro_en: 'line 1\nline 2',
          intro_jp: '',
          intro_zh: '',
        },
      }),
    )

    const result = await getGameMetadata('game-norm-1', 'en')
    expect(result.intro).toBe('line 1 line 2')
  })

  it('resolves relative cover URL against image bed base URL', async () => {
    mockFetch.mockResolvedValue(
      okResponse({
        data: {
          title_jp: 'T',
          title_en: 'T',
          title_zh: '',
          intro_en: '',
          intro_jp: '',
          intro_zh: '',
          covers: [{ language: 'en', url: 'game/1900/cover/a.webp', dims: [900, 600] }],
        },
      }),
    )

    const result = await getGameMetadata('game-cover-rel', 'en')
    expect(result.coverUrl).toMatch(/^https?:\/\/.+\/game\/1900\/cover\/a\.webp$/)
  })

  it('returns cached result on second call without re-fetching', async () => {
    mockFetch.mockResolvedValue(
      okResponse({
        data: {
          title_jp: 'Cached',
          title_en: '',
          title_zh: '',
          intro_jp: '',
          intro_en: '',
          intro_zh: '',
        },
      }),
    )

    await getGameMetadata('game-cached-1', 'ja')
    await getGameMetadata('game-cached-1', 'ja')

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('throws NotFoundError for 404', async () => {
    mockFetch.mockResolvedValue(errorResponse(404))
    await expect(getGameMetadata('game-404', 'en')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('throws BackendError for 500', async () => {
    mockFetch.mockResolvedValue(errorResponse(500))
    const err = await getGameMetadata('game-500', 'en').catch(e => e)
    expect(err).toBeInstanceOf(BackendError)
    expect((err as { status: number }).status).toBe(500)
  })

  it('throws BackendError(502) on network failure', async () => {
    mockFetch.mockRejectedValue(new TypeError('fetch failed'))
    const err = await getGameMetadata('game-net-err', 'en').catch(e => e)
    expect(err).toBeInstanceOf(BackendError)
    expect((err as { status: number }).status).toBe(502)
  })
})

// ─── getCharacterMetadata ─────────────────────────────────────────────────────

describe('getCharacterMetadata', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    config.OG_CACHE_DISABLED = false
  })

  it('fetches character and transforms data', async () => {
    mockFetch.mockResolvedValue(
      okResponse({
        data: {
          name_zh: '角色名',
          name_jp: '',
          name_en: '',
          intro_zh: '中文简介',
          intro_jp: '',
          intro_en: '',
          image: '/char.webp',
        },
      }),
    )

    const result = await getCharacterMetadata('char-zh-1', 'zh')
    expect(result.name).toBe('角色名')
    expect(result.intro).toBe('中文简介')
    expect(result.imageUrl).toMatch(/^https?:\/\/.+\/char\.webp$/)
  })

  it('throws NotFoundError for 404', async () => {
    mockFetch.mockResolvedValue(errorResponse(404))
    await expect(getCharacterMetadata('char-404', 'en')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('throws BackendError(504) on timeout', async () => {
    const timeoutErr = new Error('The operation was aborted due to timeout')
    timeoutErr.name = 'TimeoutError'
    mockFetch.mockRejectedValue(timeoutErr)

    const err = await getCharacterMetadata('char-timeout', 'en').catch(e => e)
    expect(err).toBeInstanceOf(BackendError)
    expect((err as { status: number }).status).toBe(504)
  })
})

// ─── getDeveloperMetadata ─────────────────────────────────────────────────────

describe('getDeveloperMetadata', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    config.OG_CACHE_DISABLED = false
  })

  it('fetches developer and transforms data', async () => {
    mockFetch.mockResolvedValue(
      okResponse({
        data: {
          name: 'Key Software',
          aliases: ['KS'],
          logo: '/logo.png',
          intro_en: 'We make great VNs.',
          intro_jp: '',
          intro_zh: '',
        },
      }),
    )

    const result = await getDeveloperMetadata('dev-en-1', 'en')
    expect(result.name).toBe('Key Software')
    expect(result.intro).toBe('We make great VNs.')
    expect(result.logoUrl).toMatch(/^https?:\/\/.+\/logo\.png$/)
  })

  it('throws BackendError for non-404 error status', async () => {
    mockFetch.mockResolvedValue(errorResponse(503))
    const err = await getDeveloperMetadata('dev-503', 'en').catch(e => e)
    expect(err).toBeInstanceOf(BackendError)
    expect((err as { status: number }).status).toBe(503)
  })
})
