import { HttpStatus, Injectable } from '@nestjs/common'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { PrismaService } from '../../../prisma.service'
import argon2 from 'argon2'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { getPreferredLang } from '../helpers/user-language-preference-getter.helper'
import { CreateUserDto } from '../dto/req/CreateUser.req.dto'
import { CreateUserResDto } from '../dto/res/create-user.res.dto'
import { LoginDto } from '../dto/req/Login.req.dto'
import { LoginResDto } from '../dto/res/Login.res.dto'
import { UserStatus } from '../../../shared/enums/auth/user-status.enum'
import { verifyPassword } from '../utils/verify-password.util'
import { LoginSessionService } from '../../auth/services/login-session.service'
import { VerificationCodeService } from '../../auth/services/vrification-code.service'
import { UserContentLimit } from '../interfaces/user.interface'
import { UserLoginSessionStatus } from '../../../shared/enums/auth/user-login-session-status.enum'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'
import { BanUserReqDto } from '../dto/req/ban-user.req.dto'
import { Prisma } from '@prisma/client'

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ShionConfigService,
    private readonly loginSessionService: LoginSessionService,
    private readonly verificationCodeService: VerificationCodeService,
  ) {}
  async create(user: CreateUserDto, request: RequestWithUser): Promise<CreateUserResDto> {
    const { code, uuid } = user
    const { verified } = await this.verificationCodeService.verify({
      uuid,
      code,
      email: user.email,
    })
    if (!verified) {
      throw new ShionBizException(
        ShionBizCode.AUTH_VERIFICATION_CODE_ERROR,
        'shion-biz.AUTH_VERIFICATION_CODE_ERROR',
      )
    }

    const lang = user.lang || getPreferredLang(request.headers['accept-language'])

    if (!this.configService.get('allowRegister')) {
      throw new ShionBizException(
        ShionBizCode.USER_NOT_ALLOW_REGISTER,
        'shion-biz.USER_NOT_ALLOW_REGISTER',
      )
    }
    if (await this.prisma.user.findUnique({ where: { email: user.email } })) {
      throw new ShionBizException(
        ShionBizCode.USER_EMAIL_ALREADY_EXISTS,
        'shion-biz.USER_EMAIL_ALREADY_EXISTS',
      )
    }
    if (await this.prisma.user.findUnique({ where: { name: user.name } })) {
      throw new ShionBizException(
        ShionBizCode.USER_NAME_ALREADY_EXISTS,
        'shion-biz.USER_NAME_ALREADY_EXISTS',
      )
    }

    const { name, email, password } = user
    const passwordHash = await argon2.hash(password)

    const createdUser = await this.prisma.user.create({
      data: {
        name,
        email,
        password: passwordHash,
        lang,
        content_limit: UserContentLimit.NEVER_SHOW_NSFW_CONTENT,
        upload_quota: {
          create: {
            size: 0n,
            used: 0n,
          },
        },
        favorites: {
          create: {
            name: 'default',
            default: true,
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        created: true,
      },
    })
    return createdUser
  }

  async login(user: LoginDto, req: RequestWithUser): Promise<LoginResDto> {
    const { identifier, password } = user
    const ip = (req.headers['x-real-ip'] as string) || (req.headers['cf-connecting-ip'] as string)
    const user_agent = req.headers['user-agent']
    const device = { ip, user_agent }

    const foundUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: identifier, mode: 'insensitive' } },
          { name: { equals: identifier, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        password: true,
        email: true,
        avatar: true,
        cover: true,
        role: true,
        lang: true,
        content_limit: true,
        status: true,
      },
    })

    if (!foundUser) {
      throw new ShionBizException(
        ShionBizCode.USER_NOT_FOUND,
        'shion-biz.USER_NOT_FOUND',
        undefined,
        HttpStatus.NOT_FOUND,
      )
    }
    if (foundUser.status === UserStatus.BANNED) {
      throw new ShionBizException(ShionBizCode.USER_BANNED, 'shion-biz.USER_BANNED')
    }

    const isPasswordValid = await verifyPassword(password, foundUser.password)
    if (!isPasswordValid) {
      throw new ShionBizException(
        ShionBizCode.USER_INVALID_PASSWORD,
        'shion-biz.USER_INVALID_PASSWORD',
        undefined,
        HttpStatus.UNAUTHORIZED,
      )
    }

    const { token, refreshToken: refresh_token } = await this.loginSessionService.issueOnLogin(
      foundUser.id,
      device,
      foundUser.role,
      foundUser.content_limit,
    )

    await this.prisma.user.update({
      where: { id: foundUser.id },
      data: { last_login_at: new Date() },
    })

    return {
      token,
      refresh_token,
    }
  }

  async refreshToken(refresh_token: string, req: RequestWithUser) {
    if (!refresh_token) {
      throw new ShionBizException(
        ShionBizCode.AUTH_INVALID_REFRESH_TOKEN,
        'shion-biz.AUTH_INVALID_REFRESH_TOKEN',
        undefined,
        HttpStatus.UNAUTHORIZED,
      )
    }
    const ip = (req.headers['x-real-ip'] as string) || (req.headers['cf-connecting-ip'] as string)
    const user_agent = req.headers['user-agent']
    const device = { ip, user_agent }

    const { token: new_token, refreshToken: new_refresh_token } =
      await this.loginSessionService.refresh(refresh_token, device)

    return {
      token: new_token,
      refresh_token: new_refresh_token,
    }
  }

  async getMe(req: RequestWithUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.sub },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        cover: true,
        role: true,
        lang: true,
        content_limit: true,
      },
    })

    if (!user) {
      throw new ShionBizException(ShionBizCode.USER_NOT_FOUND, 'shion-biz.USER_NOT_FOUND')
    }

    return user
  }

  async checkName(name: string) {
    const exists = await this.prisma.user.findUnique({ where: { name } })
    return {
      exists: !!exists,
    }
  }

  async getById(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        avatar: true,
        role: true,
        created: true,
        status: true,
      },
    })
    if (!user) {
      throw new ShionBizException(ShionBizCode.USER_NOT_FOUND, 'shion-biz.USER_NOT_FOUND')
    }
    const resource = await this.prisma.gameDownloadResource.count({
      where: {
        creator_id: id,
      },
    })
    const comment = await this.prisma.comment.count({
      where: {
        creator_id: id,
      },
    })
    const favorite = await this.prisma.favoriteItem.count({
      where: {
        favorite: {
          user_id: id,
        },
      },
    })
    const edit = await this.prisma.editRecord.count({
      where: {
        actor_id: id,
      },
    })
    return {
      ...user,
      resource_count: resource,
      comment_count: comment,
      favorite_count: favorite,
      edit_count: edit,
    }
  }

  async ban(
    id: number,
    dto: BanUserReqDto,
    _tx?: Prisma.TransactionClient,
    notThrowNotFound?: boolean,
  ) {
    const execute = async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.findUnique({
        where: { id, role: { not: ShionlibUserRoles.SUPER_ADMIN } },
        select: { id: true, status: true },
      })
      if (!user) {
        if (notThrowNotFound) return
        throw new ShionBizException(ShionBizCode.USER_NOT_FOUND, 'shion-biz.USER_NOT_FOUND')
      }
      if (user.status === UserStatus.BANNED) {
        throw new ShionBizException(
          ShionBizCode.USER_ALREADY_BANNED,
          'shion-biz.USER_ALREADY_BANNED',
        )
      }

      const { banned_by, banned_reason, banned_duration_days, is_permanent, delete_user_comments } =
        dto
      if (!is_permanent && (banned_duration_days == null || banned_duration_days <= 0))
        throw new ShionBizException(
          ShionBizCode.USER_INVALID_BAN_DURATION,
          'shion-biz.USER_INVALID_BAN_DURATION',
        )

      await tx.userBannedRecord.create({
        data: { user_id: id, banned_by, banned_reason, banned_duration_days, is_permanent },
      })
      await tx.user.update({ where: { id }, data: { status: UserStatus.BANNED } })
      await tx.userLoginSession.updateMany({
        where: { user_id: id },
        data: {
          status: UserLoginSessionStatus.BLOCKED,
          blocked_at: new Date(),
          blocked_reason: 'user_banned',
        },
      })
      const sessions = await tx.userLoginSession.findMany({
        where: { user_id: id },
        select: { family_id: true },
      })
      for (const session of sessions) {
        await this.loginSessionService.blockAllSessions(
          session.family_id,
          new Date(Date.now() + (banned_duration_days ?? 1) * 24 * 60 * 60 * 1000),
        )
      }
      if (delete_user_comments) await tx.comment.deleteMany({ where: { creator_id: id } })
    }

    if (_tx) return execute(_tx)
    return this.prisma.$transaction(execute)
  }

  async unban(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id, role: { not: ShionlibUserRoles.SUPER_ADMIN } },
      select: { id: true, status: true },
    })
    if (!user) {
      throw new ShionBizException(ShionBizCode.USER_NOT_FOUND, 'shion-biz.USER_NOT_FOUND')
    }
    if (user.status === UserStatus.ACTIVE) {
      throw new ShionBizException(
        ShionBizCode.USER_ALREADY_UNBANNED,
        'shion-biz.USER_ALREADY_UNBANNED',
      )
    }
    await this.prisma.$transaction(async tx => {
      const record = await tx.userBannedRecord.findFirst({
        where: { user_id: id, unbanned_at: null },
        orderBy: { banned_at: 'desc' },
        select: { id: true },
      })
      if (record) {
        await tx.userBannedRecord.update({
          where: { id: record.id },
          data: { unbanned_at: new Date() },
        })
      }
      await tx.user.update({
        where: { id },
        data: { status: UserStatus.ACTIVE },
      })
    })
  }
}
