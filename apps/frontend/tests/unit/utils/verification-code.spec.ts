import { beforeEach, describe, expect, it, vi } from 'vitest'

const post = vi.fn()

vi.mock('../../../utils/request', () => ({
  shionlibRequest: () => ({
    post,
  }),
}))

import { verficationCodeUtil } from '../../../utils/verification-code'

describe('utils/verification-code (unit)', () => {
  beforeEach(() => {
    post.mockReset()
  })

  it('requests verification code by email', async () => {
    post.mockResolvedValueOnce({ code: 0, data: { uuid: 'u1' } })
    const util = verficationCodeUtil()
    await util.get('user@example.com')

    expect(post).toHaveBeenCalledWith('/auth/code/request', {
      data: { email: 'user@example.com' },
    })
  })

  it('verifies code with uuid and code', async () => {
    post.mockResolvedValueOnce({ code: 0, data: { verified: true } })
    const util = verficationCodeUtil()
    await util.verify('uuid-1', '123456')

    expect(post).toHaveBeenCalledWith('/auth/code/verify', {
      data: { uuid: 'uuid-1', code: '123456' },
    })
  })
})
