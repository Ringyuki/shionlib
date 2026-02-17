import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { EmailService } from '../../email/services/email.service'
import { randomUUID } from 'node:crypto'
import { ForgetPasswordReqDto } from '../dto/req/forget-password.req.dto'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { CacheService } from '../../cache/services/cache.service'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { CheckForgetPasswordReqDto } from '../dto/req/check.req.dto'
import { ResetPasswordReqDto } from '../dto/req/reset-password.req.dto'
import argon2 from 'argon2'
import { UserLoginSessionStatus } from '../../../shared/enums/auth/user-login-session-status.enum'

@Injectable()
export class PasswordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly cacheService: CacheService,
    private readonly shionConfigService: ShionConfigService,
  ) {}

  async getEmail(dto: ForgetPasswordReqDto) {
    const { email } = dto
    const user = await this.prisma.user.findUnique({
      where: { email },
    })
    if (!user) {
      throw new ShionBizException(ShionBizCode.USER_NOT_FOUND, 'shion-biz.USER_NOT_FOUND')
    }

    const uuid = randomUUID()
    const key = `forgetPassword:${uuid}-${email}`
    const value = {
      email,
      token: uuid,
    }
    const ttlMs = 60 * 10 * 1000 // 10 minutes
    await this.cacheService.set<{ email: string; token: string }>(key, value, ttlMs)

    const resetLink = this.buildResetPasswordLink(uuid, email)
    await this.emailService.sendPasswordResetLink(email, resetLink, ttlMs / 1000)
  }

  private buildResetPasswordLink(token: string, email: string): string {
    const siteUrl = this.shionConfigService.get('siteUrl')
    const resetUrl = new URL('/user/password/forget', siteUrl)
    resetUrl.searchParams.set('token', token)
    resetUrl.searchParams.set('email', email)

    return resetUrl.toString()
  }

  async check(dto: CheckForgetPasswordReqDto) {
    const { token, email } = dto
    const key = `forgetPassword:${token}-${email}`
    const value = await this.cacheService.get<{ email: string; token: string }>(key)
    const isValid = value?.email === email && value?.token === token
    if (isValid) return true
    else return false
  }

  async resetPassword(dto: ResetPasswordReqDto) {
    const { password, email, token } = dto
    const key = `forgetPassword:${token}-${email}`
    const isValid = await this.check({ token, email })
    if (!isValid) {
      throw new ShionBizException(
        ShionBizCode.AUTH_INVALID_RESET_PASSWORD_TOKEN,
        'shion-biz.AUTH_INVALID_RESET_PASSWORD_TOKEN',
      )
    }
    const user = await this.prisma.user.findUnique({
      where: { email },
    })
    if (!user) {
      throw new ShionBizException(ShionBizCode.USER_NOT_FOUND, 'shion-biz.USER_NOT_FOUND')
    }

    const passwordHash = await argon2.hash(password)
    await this.prisma.$transaction(async tx => {
      await tx.user.update({
        where: { id: user.id },
        data: { password: passwordHash },
      })
      await tx.userLoginSession.updateMany({
        where: { user_id: user.id },
        data: {
          status: UserLoginSessionStatus.BLOCKED,
          blocked_at: new Date(),
          blocked_reason: 'user_password_changed',
        },
      })
    })
    await this.cacheService.del(key)
  }
}
