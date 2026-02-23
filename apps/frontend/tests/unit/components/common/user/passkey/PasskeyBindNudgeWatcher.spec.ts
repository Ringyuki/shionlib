// @vitest-environment jsdom
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLocalStorageMock } from '../../../../_helpers/local-storage'

const hoisted = vi.hoisted(() => ({
  maybeOpenMock: vi.fn(),
}))

vi.mock('@/components/common/user/passkey/usePostLoginPasskeyNudge', () => ({
  usePostLoginPasskeyNudge: () => ({
    maybeOpen: hoisted.maybeOpenMock,
  }),
}))

const loadWatcherDeps = async () => {
  vi.resetModules()
  vi.stubGlobal('localStorage', createLocalStorageMock())
  vi.stubGlobal('sessionStorage', createLocalStorageMock())

  const [{ PasskeyBindNudgeWatcher }, { useAuthDialogStore }, { useShionlibUserStore }] =
    await Promise.all([
      import('@/components/common/user/passkey/PasskeyBindNudgeWatcher'),
      import('@/store/authDialogStore'),
      import('@/store/userStore'),
    ])

  return { PasskeyBindNudgeWatcher, useAuthDialogStore, useShionlibUserStore }
}

describe('components/common/user/passkey/PasskeyBindNudgeWatcher (unit)', () => {
  beforeEach(() => {
    hoisted.maybeOpenMock.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('triggers passkey nudge check after login success event when user id arrives later', async () => {
    const { PasskeyBindNudgeWatcher, useAuthDialogStore, useShionlibUserStore } =
      await loadWatcherDeps()
    useAuthDialogStore.setState({ loginSuccessNonce: 0 }, false)
    const initialUser = useShionlibUserStore.getState().user
    useShionlibUserStore.setState({ user: { ...initialUser, id: 0 } }, false)

    render(React.createElement(PasskeyBindNudgeWatcher))

    act(() => {
      useAuthDialogStore.getState().markLoginSuccess()
    })
    expect(hoisted.maybeOpenMock).not.toHaveBeenCalled()

    act(() => {
      const currentUser = useShionlibUserStore.getState().user
      useShionlibUserStore.setState(
        {
          user: {
            ...currentUser,
            id: 42,
          },
        },
        false,
      )
    })

    await waitFor(() => {
      expect(hoisted.maybeOpenMock).toHaveBeenCalledTimes(1)
      expect(hoisted.maybeOpenMock).toHaveBeenCalledWith(42)
    })
  })

  it('does not trigger without a login success event', async () => {
    const { PasskeyBindNudgeWatcher, useShionlibUserStore } = await loadWatcherDeps()
    const initialUser = useShionlibUserStore.getState().user
    useShionlibUserStore.setState({ user: { ...initialUser, id: 0 } }, false)

    render(React.createElement(PasskeyBindNudgeWatcher))

    act(() => {
      const currentUser = useShionlibUserStore.getState().user
      useShionlibUserStore.setState(
        {
          user: {
            ...currentUser,
            id: 9,
          },
        },
        false,
      )
    })

    await new Promise(resolve => setTimeout(resolve, 0))
    expect(hoisted.maybeOpenMock).not.toHaveBeenCalled()
  })
})
