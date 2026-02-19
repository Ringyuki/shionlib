jest.mock('node:crypto', () => ({
  randomUUID: jest.fn(),
}))

import { randomUUID } from 'node:crypto'
import { EmailService } from '../../email/services/email.service'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { VerificationCodeService } from './vrification-code.service'

describe('VerificationCodeService', () => {
  const randomUUIDMock = randomUUID as jest.Mock

  const createService = () => {
    const emailService = {
      sendVerificationCode: jest.fn(),
    } as unknown as EmailService

    const cacheManager = {
      set: jest.fn(),
      get: jest.fn(),
    }

    const service = new VerificationCodeService(emailService, cacheManager as any)
    return { service, emailService, cacheManager }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('request stores code in cache and returns uuid', async () => {
    const { service, emailService, cacheManager } = createService()
    randomUUIDMock
      .mockReturnValueOnce('abcdef12-0000-4000-8000-000000000000') // for code
      .mockReturnValueOnce('11111111-1111-4111-8111-111111111111') // for uuid

    const result = await service.request('u@example.com', 120)

    expect(result).toEqual({
      uuid: '11111111-1111-4111-8111-111111111111',
    })
    expect(cacheManager.set).toHaveBeenCalledWith(
      'verificationCode:11111111-1111-4111-8111-111111111111-u@example.com',
      expect.any(String),
      120_000,
    )

    const cachedPayload = JSON.parse((cacheManager.set as jest.Mock).mock.calls[0][1])
    expect(cachedPayload).toMatchObject({
      email: 'u@example.com',
      code: 'ABCDEF',
    })
    expect(typeof cachedPayload.createdAt).toBe('number')
    expect(emailService.sendVerificationCode).toHaveBeenCalledWith('u@example.com', 'ABCDEF', 120)
  })

  it('request throws when cache/email operation fails', async () => {
    const { service, cacheManager } = createService()
    ;(service as any).logger.error = jest.fn()
    randomUUIDMock.mockReturnValue('11111111-1111-4111-8111-111111111111')
    ;(cacheManager.set as jest.Mock).mockRejectedValue(new Error('cache down'))

    await expect(service.request('u@example.com', 60)).rejects.toThrow(
      'Failed to request verification code',
    )
  })

  it('verify returns verified=true for matching email/code', async () => {
    const { service, cacheManager } = createService()
    ;(cacheManager.get as jest.Mock).mockResolvedValue(
      JSON.stringify({ email: 'u@example.com', code: 'ABCDEF' }),
    )

    const result = await service.verify({
      uuid: '11111111-1111-4111-8111-111111111111',
      email: 'u@example.com',
      code: 'ABCDEF',
    })

    expect(result).toEqual({ verified: true })
  })

  it('verify throws AUTH_VERIFICATION_CODE_NOT_FOUND_OR_EXPIRED when missing', async () => {
    const { service, cacheManager } = createService()
    ;(cacheManager.get as jest.Mock).mockResolvedValue(null)

    await expect(
      service.verify({
        uuid: '11111111-1111-4111-8111-111111111111',
        email: 'u@example.com',
        code: 'ABCDEF',
      }),
    ).rejects.toMatchObject({
      code: ShionBizCode.AUTH_VERIFICATION_CODE_NOT_FOUND_OR_EXPIRED,
    })
  })

  it('verify throws AUTH_VERIFICATION_CODE_ERROR when code mismatches', async () => {
    const { service, cacheManager } = createService()
    ;(cacheManager.get as jest.Mock).mockResolvedValue(
      JSON.stringify({ email: 'u@example.com', code: 'ZZZZZZ' }),
    )

    await expect(
      service.verify({
        uuid: '11111111-1111-4111-8111-111111111111',
        email: 'u@example.com',
        code: 'ABCDEF',
      }),
    ).rejects.toMatchObject({
      code: ShionBizCode.AUTH_VERIFICATION_CODE_ERROR,
    })
  })
})
