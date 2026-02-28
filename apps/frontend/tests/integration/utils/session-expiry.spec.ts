import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLocalStorageMock } from '../../unit/_helpers/local-storage'

describe('utils/auth/session-expiry (integration)', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('guards payload shape and ignores invalid persistence payloads', async () => {
    vi.stubGlobal('localStorage', createLocalStorageMock())
    const { isAuthSessionPayload, persistAuthSessionExpiry, readAuthSessionExpiry } =
      await import('../../../utils/auth/session-expiry')

    expect(isAuthSessionPayload(null)).toBe(false)
    expect(isAuthSessionPayload({ accessTokenExpiresAt: 1 })).toBe(false)
    expect(
      isAuthSessionPayload({
        accessTokenExpiresAt: '2026-02-28T10:00:00.000Z',
        refreshTokenExpiresAt: null,
      }),
    ).toBe(true)

    persistAuthSessionExpiry({ accessTokenExpiresAt: 1 } as never)
    expect(readAuthSessionExpiry()).toBeNull()
  })

  it('reads persisted payloads and rejects malformed storage values', async () => {
    const localStorage = createLocalStorageMock()
    vi.stubGlobal('localStorage', localStorage)
    const { persistAuthSessionExpiry, readAuthSessionExpiry, clearAuthSessionExpiry } =
      await import('../../../utils/auth/session-expiry')

    persistAuthSessionExpiry({
      accessTokenExpiresAt: '2026-02-28T10:00:00.000Z',
      refreshTokenExpiresAt: '2026-03-07T10:00:00.000Z',
    })
    expect(readAuthSessionExpiry()).toEqual({
      accessTokenExpiresAt: '2026-02-28T10:00:00.000Z',
      refreshTokenExpiresAt: '2026-03-07T10:00:00.000Z',
    })

    localStorage.setItem('shionlib:auth-session-expiry', '{bad-json')
    expect(readAuthSessionExpiry()).toBeNull()

    localStorage.setItem(
      'shionlib:auth-session-expiry',
      JSON.stringify({ accessTokenExpiresAt: 123, refreshTokenExpiresAt: 'bad' }),
    )
    expect(readAuthSessionExpiry()).toBeNull()

    clearAuthSessionExpiry()
    expect(readAuthSessionExpiry()).toBeNull()
  })

  it('evaluates refresh windows from access token expiry', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-28T09:59:30.000Z'))
    vi.stubGlobal('localStorage', createLocalStorageMock())
    const { shouldRefreshAuthSession } = await import('../../../utils/auth/session-expiry')

    expect(shouldRefreshAuthSession(null, 45_000)).toBe(false)
    expect(
      shouldRefreshAuthSession(
        {
          accessTokenExpiresAt: '2026-02-28T10:00:00.000Z',
          refreshTokenExpiresAt: '2026-03-07T10:00:00.000Z',
        },
        45_000,
      ),
    ).toBe(true)
    expect(
      shouldRefreshAuthSession(
        {
          accessTokenExpiresAt: '2026-02-28T10:10:00.000Z',
          refreshTokenExpiresAt: '2026-03-07T10:10:00.000Z',
        },
        45_000,
      ),
    ).toBe(false)
  })
})
