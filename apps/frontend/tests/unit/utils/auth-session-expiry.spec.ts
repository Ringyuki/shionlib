import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLocalStorageMock } from '../_helpers/local-storage'

describe('utils/auth/session-expiry (unit)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('persists, reads, and clears auth session expiry payloads', async () => {
    vi.stubGlobal('localStorage', createLocalStorageMock())
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

    clearAuthSessionExpiry()
    expect(readAuthSessionExpiry()).toBeNull()
  })

  it('computes refresh windows from access token expiry', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-28T09:59:30.000Z'))
    vi.stubGlobal('localStorage', createLocalStorageMock())
    const { shouldRefreshAuthSession } = await import('../../../utils/auth/session-expiry')

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
