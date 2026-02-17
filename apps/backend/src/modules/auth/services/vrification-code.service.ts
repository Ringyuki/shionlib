import { Injectable, Inject, Logger } from '@nestjs/common'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Cache } from 'cache-manager'
import { randomUUID as nodeRandomUUID } from 'node:crypto'
import { EmailService } from '../../email/services/email.service'
import { VerifyCodeDto } from '../dto/req/verify-code.req.dto'
import { ShionBizCode } from 'src/shared/enums/biz-code/shion-biz-code.enum'
import { ShionBizException } from 'src/common/exceptions/shion-business.exception'

@Injectable()
export class VerificationCodeService {
  private readonly logger = new Logger(VerificationCodeService.name)

  constructor(
    private readonly emailService: EmailService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async request(
    email: string,
    expSeconds?: number,
  ): Promise<{
    uuid: string
  }> {
    const code = this.generateVerificationCode()
    const uuid = nodeRandomUUID()
    const expirationTime = expSeconds ? expSeconds : 60 * 10 // 10 minutes

    const key = `verificationCode:${uuid}-${email}`
    const value = {
      email,
      code,
      createdAt: Date.now(),
    }

    try {
      await this.cacheManager.set(key, JSON.stringify(value), expirationTime * 1000)
      await this.emailService.sendVerificationCode(email, code, expSeconds)

      return {
        uuid,
      }
    } catch (error) {
      this.logger.error('Failed to request verification code', error)
      throw new Error('Failed to request verification code')
    }
  }

  async verify(verificationDto: VerifyCodeDto): Promise<{
    verified: boolean
  }> {
    const result = await this._verify(verificationDto)
    if (!result.verified) {
      switch (result.reason) {
        case 'not_found':
          throw new ShionBizException(
            ShionBizCode.AUTH_VERIFICATION_CODE_NOT_FOUND_OR_EXPIRED,
            'shion-biz.AUTH_VERIFICATION_CODE_NOT_FOUND_OR_EXPIRED',
          )
        case 'error':
          throw new ShionBizException(
            ShionBizCode.AUTH_VERIFICATION_CODE_ERROR,
            'shion-biz.AUTH_VERIFICATION_CODE_ERROR',
          )
        default:
          throw new ShionBizException(
            ShionBizCode.AUTH_VERIFICATION_CODE_ERROR,
            'shion-biz.AUTH_VERIFICATION_CODE_ERROR',
          )
      }
    }
    return {
      verified: true,
    }
  }

  private async _verify(verificationDto: VerifyCodeDto): Promise<{
    verified: boolean
    reason?: 'not_found' | 'error'
  }> {
    const { uuid, code, email } = verificationDto
    const key = `verificationCode:${uuid}-${email}`

    try {
      const value = await this.cacheManager.get<string>(key)

      if (!value) {
        return {
          verified: false,
          reason: 'not_found',
        }
      }

      const storedData = JSON.parse(value)

      if (code !== storedData.code || email !== storedData.email) {
        return {
          verified: false,
          reason: 'error',
        }
      }

      // logically, the code should be deleted after verification
      // however, if we delete the code immediately after verification,
      // in some cases(e.g. verify more than one code in single request)
      // if the first one is correct, but the second one is incorrect, request failed
      // and the user fixs the error then request again, it will not work anymore
      // because the code is already deleted.
      // in most situations, we can ignore the risk of code leakage, just keep it here for future reference.
      // await this.cacheManager.del(key)

      return {
        verified: true,
      }
    } catch (error) {
      this.logger.error('Failed to verify code', error)
      throw new Error('Failed to verify code')
    }
  }

  private generateVerificationCode(): string {
    return nodeRandomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()
  }
}
