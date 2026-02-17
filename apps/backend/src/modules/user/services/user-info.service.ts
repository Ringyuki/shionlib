import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import argon2 from 'argon2'
import { VerificationCodeService } from '../../auth/services/vrification-code.service'
import { UpdateEmailReqDto } from '../dto/req/update-email.req.dto'
import { UserContentLimit, UserLang } from '../interfaces/user.interface'
import { SmallFileUploadService } from '../../upload/services/small-file-upload.service'
import { UserLoginSessionStatus } from '../../../shared/enums/auth/user-login-session-status.enum'
import { verifyPassword } from '../utils/verify-password.util'

@Injectable()
export class UserInfoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly verificationCodeService: VerificationCodeService,
    private readonly smallFileUploadService: SmallFileUploadService,
  ) {}

  async updateAvatar(avatar: Express.Multer.File, user_id: number) {
    if (!avatar) {
      throw new ShionBizException(
        ShionBizCode.SMALL_FILE_UPLOAD_FILE_NO_FILE_PROVIDED,
        'shion-biz.SMALL_FILE_UPLOAD_FILE_NO_FILE_PROVIDED',
      )
    }
    if (avatar.size > 5 * 1024 * 1024) {
      throw new ShionBizException(
        ShionBizCode.SMALL_FILE_UPLOAD_FILE_SIZE_EXCEEDS_LIMIT,
        'shion-biz.SMALL_FILE_UPLOAD_FILE_SIZE_EXCEEDS_LIMIT',
      )
    }
    const { key } = await this.smallFileUploadService._uploadUserAvatar(user_id, avatar)
    await this.updateUserInfo('avatar', key, user_id)

    return {
      key,
    }
  }

  async updateCover(cover: string, user_id: number) {
    await this.updateUserInfo('cover', cover, user_id)
  }

  async updateName(name: string, user_id: number) {
    const existing_name = await this.prisma.user.findUnique({
      where: { name },
      select: { id: true },
    })
    if (existing_name) {
      throw new ShionBizException(
        ShionBizCode.USER_NAME_ALREADY_EXISTS,
        'shion-biz.USER_NAME_ALREADY_EXISTS',
      )
    }
    await this.updateUserInfo('name', name, user_id)

    return {
      name,
    }
  }

  async requestCode(user_id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: user_id },
      select: { email: true },
    })
    if (!user) {
      throw new ShionBizException(ShionBizCode.USER_NOT_FOUND, 'shion-biz.USER_NOT_FOUND')
    }
    const { email } = user
    const { uuid } = await this.verificationCodeService.request(email, 60 * 30)
    return { uuid }
  }

  async updateEmail(updateEmailReqDto: UpdateEmailReqDto, user_id: number) {
    const { email, currentUuid, currentCode, newUuid, newCode } = updateEmailReqDto
    const old_email = await this.prisma.user.findUniqueOrThrow({
      where: { id: user_id },
      select: { email: true },
    })
    await this.verificationCodeService.verify({
      uuid: currentUuid,
      code: currentCode,
      email: old_email.email,
    })
    await this.verificationCodeService.verify({
      uuid: newUuid,
      code: newCode,
      email: email,
    })
    await this.updateUserInfo('email', email, user_id)
    await this.prisma.userLoginSession.updateMany({
      where: {
        user_id,
      },
      data: {
        status: UserLoginSessionStatus.BLOCKED,
        blocked_at: new Date(),
        blocked_reason: 'user_email_changed',
      },
    })
  }

  async updatePassword(password: string, old_password: string, user_id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: user_id },
    })
    if (!user) {
      throw new ShionBizException(ShionBizCode.USER_NOT_FOUND, 'shion-biz.USER_NOT_FOUND')
    }

    const isPasswordValid = await verifyPassword(old_password, user.password)
    if (!isPasswordValid) {
      throw new ShionBizException(
        ShionBizCode.USER_INVALID_PASSWORD,
        'shion-biz.USER_INVALID_PASSWORD',
      )
    }
    const passwordHash = await argon2.hash(password)
    await this.updateUserInfo('password', passwordHash, user_id)
    await this.prisma.userLoginSession.updateMany({
      where: {
        user_id,
      },
      data: {
        status: UserLoginSessionStatus.BLOCKED,
        blocked_at: new Date(),
        blocked_reason: 'user_password_changed',
      },
    })
  }

  async updateLang(lang: string, user_id: number) {
    if (!Array.from(Object.values(UserLang)).includes(lang as UserLang)) {
      throw new ShionBizException(ShionBizCode.USER_INVALID_LANG, 'shion-biz.USER_INVALID_LANG')
    }
    await this.updateUserInfo('lang', lang, user_id)
  }

  async updateContentLimit(content_limit: number, user_id: number) {
    if (!Array.from(Object.values(UserContentLimit)).includes(content_limit as UserContentLimit)) {
      throw new ShionBizException(
        ShionBizCode.USER_INVALID_CONTENT_LIMIT,
        'shion-biz.USER_INVALID_CONTENT_LIMIT',
      )
    }
    await this.updateUserInfo('content_limit', content_limit, user_id)
  }

  private async updateUserInfo<T>(path: string, value: T, user_id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: user_id },
    })
    if (!user) {
      throw new ShionBizException(ShionBizCode.USER_NOT_FOUND, 'shion-biz.USER_NOT_FOUND')
    }
    await this.prisma.user.update({
      where: { id: user_id },
      data: { [path]: value },
    })
  }
}
