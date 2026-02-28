import React from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLocalStorageMock } from '../../../_helpers/local-storage'
import { UserRole } from '../../../../../interfaces/user/user.interface'
import { supportedLocalesEnum } from '../../../../../config/i18n/supported'

const hoisted = vi.hoisted(() => ({
  post: vi.fn(),
  refreshAuthSession: vi.fn().mockResolvedValue({
    setCookies: [],
    session: null,
  }),
}))

vi.mock('@/utils/request', () => ({
  shionlibRequest: () => ({ post: hoisted.post }),
  refreshAuthSession: hoisted.refreshAuthSession,
}))

const loggedInUser = {
  id: 7,
  name: 'alice',
  avatar: '',
  cover: '',
  bio: '',
  role: UserRole.USER,
  lang: supportedLocalesEnum.EN,
}

const setVisibilityState = (value: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value,
  })
}

const loadModules = async () => {
  vi.resetModules()
  vi.stubGlobal('localStorage', createLocalStorageMock())

  const [{ AuthSessionCheck }, { useShionlibUserStore }, sessionExpiry] = await Promise.all([
    import('../../../../../components/common/auth/AuthSessionCheck'),
    import('../../../../../store/userStore'),
    import('../../../../../utils/auth/session-expiry'),
  ])

  return {
    AuthSessionCheck,
    useShionlibUserStore,
    ...sessionExpiry,
  }
}

describe('components/common/auth/AuthSessionCheck (unit)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-28T09:59:00.000Z'))
    hoisted.post.mockReset()
    hoisted.refreshAuthSession.mockClear()
    hoisted.refreshAuthSession.mockResolvedValue({ setCookies: [], session: null })
    setVisibilityState('visible')
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('refreshes immediately when logged in but expiry is missing', async () => {
    const { AuthSessionCheck, useShionlibUserStore, clearAuthSessionExpiry } = await loadModules()
    clearAuthSessionExpiry()
    useShionlibUserStore.getState().setUser(loggedInUser)

    render(React.createElement(AuthSessionCheck))

    await act(async () => {})
    expect(hoisted.refreshAuthSession).toHaveBeenCalledTimes(1)
  })

  it('skips hidden checks and refreshes once the page becomes visible', async () => {
    const { AuthSessionCheck, useShionlibUserStore, clearAuthSessionExpiry } = await loadModules()
    clearAuthSessionExpiry()
    useShionlibUserStore.getState().setUser(loggedInUser)
    setVisibilityState('hidden')

    render(React.createElement(AuthSessionCheck))

    await act(async () => {
      vi.advanceTimersByTime(31_000)
    })
    expect(hoisted.refreshAuthSession).not.toHaveBeenCalled()

    setVisibilityState('visible')
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(hoisted.refreshAuthSession).toHaveBeenCalledTimes(1)
  })

  it('does not refresh when access token expiry is still far away', async () => {
    const { AuthSessionCheck, useShionlibUserStore, persistAuthSessionExpiry } = await loadModules()
    persistAuthSessionExpiry({
      accessTokenExpiresAt: '2026-02-28T10:10:00.000Z',
      refreshTokenExpiresAt: '2026-03-07T10:10:00.000Z',
    })
    useShionlibUserStore.getState().setUser(loggedInUser)

    render(React.createElement(AuthSessionCheck))

    await act(async () => {
      vi.advanceTimersByTime(31_000)
    })
    expect(hoisted.refreshAuthSession).not.toHaveBeenCalled()
  })
})
