jest.mock('argon2', () => ({
  __esModule: true,
  default: {
    verify: jest.fn(),
  },
}))

import argon2 from 'argon2'
import { verifyPassword } from './verify-password.util'

describe('verifyPassword', () => {
  it('delegates to argon2.verify with hash/password order', async () => {
    const verifyMock = (argon2 as unknown as { verify: jest.Mock }).verify
    verifyMock.mockResolvedValue(true)

    await expect(verifyPassword('plain-pass', 'hash-pass')).resolves.toBe(true)
    expect(verifyMock).toHaveBeenCalledWith('hash-pass', 'plain-pass')
  })
})
