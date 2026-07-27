import { ExecutionContext } from '@nestjs/common'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { PartnerAuthGuard, PARTNER_SECRET_HEADER } from './partner-auth.guard'

describe('PartnerAuthGuard', () => {
  const getContext = (headerValue?: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          headers: headerValue === undefined ? {} : { [PARTNER_SECRET_HEADER]: headerValue },
        }),
      }),
    }) as unknown as ExecutionContext

  const getGuard = (secret: string) =>
    new PartnerAuthGuard({
      get: jest.fn().mockReturnValue(secret),
    } as unknown as ShionConfigService)

  it('allows the request when the secret matches', () => {
    expect(getGuard('s3cret').canActivate(getContext('s3cret'))).toBe(true)
  })

  it('rejects a wrong secret', () => {
    expect(() => getGuard('s3cret').canActivate(getContext('wrong!'))).toThrow(ShionBizException)
  })

  it('rejects a secret of a different length', () => {
    expect(() => getGuard('s3cret').canActivate(getContext('s3'))).toThrow(ShionBizException)
  })

  it('rejects a missing header', () => {
    expect(() => getGuard('s3cret').canActivate(getContext())).toThrow(ShionBizException)
  })

  it('rejects every request when no secret is configured', () => {
    try {
      getGuard('').canActivate(getContext(''))
      throw new Error('expected the guard to reject')
    } catch (error) {
      expect(error).toBeInstanceOf(ShionBizException)
      expect((error as ShionBizException).code).toBe(ShionBizCode.PARTNER_UNAUTHORIZED)
    }
  })
})
