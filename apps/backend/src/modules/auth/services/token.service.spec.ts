import { JwtService } from '@nestjs/jwt'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'
import { TokenService } from './token.service'

describe('TokenService', () => {
  const createService = () => {
    const jwtMock = {
      signAsync: jest.fn(),
      decode: jest.fn(),
      verify: jest.fn(),
    } as unknown as JwtService

    const configMock = {
      get: jest.fn((key: string) => {
        if (key === 'token.expiresIn') return '3600'
        if (key === 'token.secret') return 'unit-test-secret'
        return undefined
      }),
    } as unknown as ShionConfigService

    const service = new TokenService(jwtMock, configMock)
    return { service, jwtMock, configMock }
  }

  it('signToken signs with configured secret/expiry and returns decoded exp', async () => {
    const { service, jwtMock } = createService()
    ;(jwtMock.signAsync as jest.Mock).mockResolvedValue('signed-token')
    ;(jwtMock.decode as jest.Mock).mockReturnValue({ exp: 1_700_000_000 })

    const result = await service.signToken({
      sub: 1,
      sid: 7,
      fid: 'family-1',
      role: ShionlibUserRoles.USER,
      content_limit: 1,
      type: 'access',
    })

    expect(jwtMock.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 1, sid: 7, type: 'access' }),
      {
        expiresIn: 3600,
        secret: 'unit-test-secret',
      },
    )
    expect(result.token).toBe('signed-token')
    expect(result.exp?.toISOString()).toBe('2023-11-14T22:13:20.000Z')
  })

  it('verifyToken returns decoded payload on success', () => {
    const { service, jwtMock } = createService()
    ;(jwtMock.verify as jest.Mock).mockReturnValue({ sub: 99 })

    const payload = service.verifyToken<{ sub: number }>('token')

    expect(payload).toEqual({ sub: 99 })
    expect(jwtMock.verify).toHaveBeenCalledWith('token', {
      secret: 'unit-test-secret',
    })
  })

  it('verifyToken throws AUTH_UNAUTHORIZED on verify failure', () => {
    const { service, jwtMock } = createService()
    ;(jwtMock.verify as jest.Mock).mockImplementation(() => {
      throw new Error('bad token')
    })

    let error: unknown
    try {
      service.verifyToken('bad-token')
    } catch (e) {
      error = e
    }

    expect(error).toBeInstanceOf(ShionBizException)
    expect((error as ShionBizException).code).toBe(ShionBizCode.AUTH_UNAUTHORIZED)
  })
})
