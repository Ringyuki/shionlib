// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => ({
  loginMock: vi.fn(),
  usePasskeyLoginMock: vi.fn(),
}))

vi.mock('@/components/common/user/passkey/usePasskeyLogin', () => ({
  usePasskeyLogin: hoisted.usePasskeyLoginMock,
}))

vi.mock('@/components/shionui/Button', () => ({
  Button: ({ children, onClick, disabled, type = 'button' }: any) =>
    React.createElement('button', { type, onClick, disabled }, children),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('lucide-react', () => ({
  KeyRound: () => null,
}))

import { PasskeyLoginButton } from '@/components/common/user/passkey/PasskeyLoginButton'

describe('components/common/user/passkey/PasskeyLoginButton (unit)', () => {
  beforeEach(() => {
    sessionStorage.clear()
    hoisted.loginMock.mockReset()
    hoisted.usePasskeyLoginMock.mockReset()
    hoisted.usePasskeyLoginMock.mockReturnValue({
      loading: false,
      login: hoisted.loginMock,
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('auto-attempts passkey login once when enabled', async () => {
    hoisted.loginMock.mockResolvedValue({ ok: false, reason: 'unsupported' })

    render(React.createElement(PasskeyLoginButton, { autoAttempt: true }))

    await waitFor(() => {
      expect(hoisted.loginMock).toHaveBeenCalledTimes(1)
      expect(hoisted.loginMock).toHaveBeenCalledWith({ silent: true })
    })
  })

  it('suppresses future auto-attempts for this session after prompt cancellation', async () => {
    hoisted.loginMock.mockResolvedValue({ ok: false, reason: 'cancelled' })

    const first = render(React.createElement(PasskeyLoginButton, { autoAttempt: true }))
    await waitFor(() => {
      expect(hoisted.loginMock).toHaveBeenCalledTimes(1)
    })
    first.unmount()

    render(React.createElement(PasskeyLoginButton, { autoAttempt: true }))

    await new Promise(resolve => setTimeout(resolve, 0))
    expect(hoisted.loginMock).toHaveBeenCalledTimes(1)
  })

  it('still allows manual passkey login after auto-attempt is suppressed', async () => {
    sessionStorage.setItem('shionlib:passkey-login:auto-attempt-suppressed', '1')
    hoisted.loginMock.mockResolvedValue({ ok: false, reason: 'cancelled' })

    render(React.createElement(PasskeyLoginButton, { autoAttempt: true }))

    await new Promise(resolve => setTimeout(resolve, 0))
    expect(hoisted.loginMock).toHaveBeenCalledTimes(0)

    fireEvent.click(screen.getByRole('button'))
    expect(hoisted.loginMock).toHaveBeenCalledTimes(1)
    expect(hoisted.loginMock).toHaveBeenCalledWith()
  })
})
