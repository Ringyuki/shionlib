import { HttpStatus, Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { TokenService } from './token.service'
import { ShionConfigService } from '../../../common/config/services/config.service'
import {
  generateOpaque,
  calcPrefix,
  hashOpaque,
  verifyOpaque,
  formatRefreshToken,
  parseRefreshToken,
} from '../utils/refresh-token.util'
import { DeviceSignals } from '../interfaces/device-signals.interface'
import { randomUUID as nodeRandomUUID } from 'node:crypto'
import { UserLoginSessionStatus } from '../../../shared/enums/auth/user-login-session-status.enum'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'
import { UserStatus } from '../../../shared/enums/auth/user-status.enum'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { CacheService } from '../../cache/services/cache.service'
import { SignResInterface } from '../interfaces/sign.res.interface'

@Injectable()
export class LoginSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly configService: ShionConfigService,
    private readonly cacheService: CacheService,
  ) {}
  async issueOnLogin(
    userId: number,
    device: DeviceSignals,
    role: ShionlibUserRoles,
    content_limit: number,
  ): Promise<SignResInterface> {
    const now = new Date()
    const fid = globalThis.crypto?.randomUUID?.() ?? nodeRandomUUID()

    const opaque = generateOpaque()
    const prefix = calcPrefix(opaque)
    const hash = await hashOpaque(opaque, this.configService.get('refresh_token.pepper'))
    const refreshTokenExp = this.calcRefreshExpiry(now, now)

    const session = await this.prisma.userLoginSession.create({
      data: {
        user_id: userId,
        refresh_token_hash: hash,
        refresh_token_prefix: prefix,
        status: UserLoginSessionStatus.ACTIVE,
        expires_at: refreshTokenExp,
        last_used_at: now,
        family_id: fid,
        ip: device.ip,
        user_agent: device.user_agent,
        device_info: device.device_info,
      },
    })

    const { token, exp: tokenExp } = await this.tokenService.signToken({
      sub: userId,
      sid: session.id,
      fid,
      role,
      content_limit,
      type: 'access',
    })

    return {
      token,
      tokenExp,
      refreshToken: formatRefreshToken(
        prefix,
        opaque,
        this.configService.get('refresh_token.algorithmVersion'),
      ),
      refreshTokenExp,
      sessionId: session.id,
      familyId: fid,
    }
  }

  async refresh(incoming: string, device: DeviceSignals): Promise<SignResInterface> {
    const now = new Date()
    const { prefix, opaque } = parseRefreshToken(
      incoming,
      this.configService.get('refresh_token.algorithmVersion'),
    )

    const outcome = await this.prisma.$transaction(async tx => {
      const old = await tx.userLoginSession.findUnique({
        where: {
          refresh_token_prefix: prefix,
        },
      })
      if (!old) {
        throw new ShionBizException(
          ShionBizCode.AUTH_INVALID_REFRESH_TOKEN,
          'shion-biz.AUTH_INVALID_REFRESH_TOKEN',
          undefined,
          HttpStatus.UNAUTHORIZED,
        )
      }
      const ok = await verifyOpaque(
        old.refresh_token_hash,
        opaque,
        this.configService.get('refresh_token.pepper'),
      )
      if (!ok) {
        throw new ShionBizException(
          ShionBizCode.AUTH_INVALID_REFRESH_TOKEN,
          'shion-biz.AUTH_INVALID_REFRESH_TOKEN',
          undefined,
          HttpStatus.UNAUTHORIZED,
        )
      }

      if (old.expires_at <= now)
        throw new ShionBizException(
          ShionBizCode.AUTH_REFRESH_TOKEN_EXPIRED,
          'shion-biz.AUTH_REFRESH_TOKEN_EXPIRED',
          undefined,
          HttpStatus.UNAUTHORIZED,
        )

      if (old.status === UserLoginSessionStatus.BLOCKED) {
        throw new ShionBizException(
          ShionBizCode.AUTH_FAMILY_BLOCKED,
          'shion-biz.AUTH_FAMILY_BLOCKED',
          undefined,
          HttpStatus.FORBIDDEN,
        )
      }

      if (old.status !== UserLoginSessionStatus.ACTIVE) {
        if (old.status === UserLoginSessionStatus.ROTATED) {
          const idemp = await this.idempWaitAndLoad(old.id)
          if (idemp) {
            return { kind: 'idempotent' as const, res: idemp }
          }
        }
        if (old.status !== UserLoginSessionStatus.REUSED) {
          await tx.userLoginSession.update({
            where: {
              id: old.id,
            },
            data: {
              status: UserLoginSessionStatus.REUSED,
              reused_at: now,
            },
          })
        }
        await tx.userLoginSession.updateMany({
          where: {
            family_id: old.family_id,
            status: UserLoginSessionStatus.ACTIVE,
          },
          data: {
            status: UserLoginSessionStatus.BLOCKED,
            blocked_at: now,
            blocked_reason: 'refresh_token_reuse_detected',
          },
        })
        await this.blockAllSessions(old.family_id, old.expires_at)
        return { kind: 'reuse' as const }
      }

      const user = await tx.user.findUnique({
        where: { id: old.user_id },
        select: { id: true, role: true, status: true, content_limit: true },
      })
      if (!user) {
        await tx.userLoginSession.updateMany({
          where: {
            family_id: old.family_id,
            status: { in: [UserLoginSessionStatus.ACTIVE, UserLoginSessionStatus.ROTATED] },
          },
          data: {
            status: UserLoginSessionStatus.BLOCKED,
            blocked_at: now,
            blocked_reason: 'user_not_found',
          },
        })
        await this.blockAllSessions(old.family_id, old.expires_at)
        return { kind: 'user_not_found' as const }
      }

      if (user.status === UserStatus.BANNED) {
        await tx.userLoginSession.updateMany({
          where: {
            family_id: old.family_id,
            status: { in: [UserLoginSessionStatus.ACTIVE, UserLoginSessionStatus.ROTATED] },
          },
          data: {
            status: UserLoginSessionStatus.BLOCKED,
            blocked_at: now,
            blocked_reason: 'user_banned',
          },
        })
        await this.blockAllSessions(old.family_id, old.expires_at)
        return { kind: 'user_banned' as const }
      }

      const firstSession = await tx.userLoginSession.findFirst({
        where: {
          family_id: old.family_id,
        },
        orderBy: {
          created: 'asc',
        },
        select: {
          created: true,
        },
      })

      const newOpaque = generateOpaque()
      const newPrefix = calcPrefix(newOpaque)
      const newHash = await hashOpaque(newOpaque, this.configService.get('refresh_token.pepper'))
      const newRefreshTokenExp = this.calcRefreshExpiry(firstSession?.created ?? now, now)

      const newer = await tx.userLoginSession.create({
        data: {
          user_id: old.user_id,
          refresh_token_hash: newHash,
          refresh_token_prefix: newPrefix,
          status: UserLoginSessionStatus.ACTIVE,
          family_id: old.family_id,
          expires_at: newRefreshTokenExp,
          last_used_at: now,
          ip: device.ip,
          user_agent: device.user_agent,
          device_info: device.device_info,
        },
      })

      await tx.userLoginSession.update({
        where: {
          id: old.id,
        },
        data: {
          status: UserLoginSessionStatus.ROTATED,
          rotated_at: now,
          replaced_by_id: newer.id,
          last_used_at: now,
        },
      })

      const { token, exp: tokenExp } = await this.tokenService.signToken({
        sub: old.user_id,
        sid: newer.id,
        fid: old.family_id,
        role: user.role,
        content_limit: user.content_limit,
        type: 'access',
      })

      const res = {
        token,
        tokenExp,
        refreshToken: formatRefreshToken(
          newPrefix,
          newOpaque,
          this.configService.get('refresh_token.algorithmVersion'),
        ),
        refreshTokenExp: newRefreshTokenExp,
        sessionId: newer.id,
        familyId: newer.family_id,
      }
      await this.idempSave(old.id, res)
      return {
        kind: 'success' as const,
        res,
      }
    })

    if (outcome && outcome.kind && outcome.kind !== 'success') {
      if (outcome.kind === 'idempotent') {
        return outcome.res
      }
      if (outcome.kind === 'reuse') {
        throw new ShionBizException(
          ShionBizCode.AUTH_REFRESH_TOKEN_REUSED,
          'shion-biz.AUTH_REFRESH_TOKEN_REUSED',
          undefined,
          HttpStatus.UNAUTHORIZED,
        )
      }
      if (outcome.kind === 'user_not_found') {
        throw new ShionBizException(ShionBizCode.USER_NOT_FOUND, 'shion-biz.USER_NOT_FOUND')
      }
      if (outcome.kind === 'user_banned') {
        throw new ShionBizException(
          ShionBizCode.USER_BANNED,
          'shion-biz.USER_BANNED',
          undefined,
          HttpStatus.UNAUTHORIZED,
        )
      }
    }

    return outcome.res
  }

  async logout(refreshToken?: string) {
    if (refreshToken) {
      const now = new Date()
      const { prefix } = parseRefreshToken(
        refreshToken,
        this.configService.get('refresh_token.algorithmVersion'),
      )
      const session = await this.prisma.userLoginSession.findUnique({
        where: {
          refresh_token_prefix: prefix,
        },
      })
      if (!session) {
        throw new ShionBizException(
          ShionBizCode.AUTH_INVALID_REFRESH_TOKEN,
          'shion-biz.AUTH_INVALID_REFRESH_TOKEN',
          undefined,
          HttpStatus.UNAUTHORIZED,
        )
      }
      await this.prisma.userLoginSession.updateMany({
        where: {
          user_id: session.user_id,
          family_id: session.family_id,
        },
        data: {
          status: UserLoginSessionStatus.BLOCKED,
          blocked_at: now,
          blocked_reason: 'user_logout',
        },
      })
      await this.blockAllSessions(session.family_id, session.expires_at)
    }
  }

  private calcRefreshExpiry(first: Date, now: Date) {
    const short = new Date(
      now.getTime() + Number(this.configService.get('refresh_token.shortWindowSec')) * 1000,
    )
    const hard = new Date(
      first.getTime() + Number(this.configService.get('refresh_token.longWindowSec')) * 1000,
    )
    return short < hard ? short : hard
  }

  private async idempSave(old_session_id: number, res: SignResInterface) {
    const cacheKey = `rt:idemp:${old_session_id}`
    await this.cacheService.set(
      cacheKey,
      res,
      this.configService.get('refresh_token.rotationGraceSec') * 1000,
    )
  }

  private async idempLoad(old_session_id: number): Promise<SignResInterface | null> {
    const cacheKey = `rt:idemp:${old_session_id}`
    return this.cacheService.get<SignResInterface>(cacheKey)
  }

  private async idempWaitAndLoad(old_session_id: number): Promise<SignResInterface | null> {
    const ttlMs = Number(this.configService.get('refresh_token.rotationGraceSec')) * 1000
    const spinLimit = Math.min(ttlMs, 150) // max 150ms to avoid long blocking
    let left = spinLimit
    while (left > 0) {
      const hit = await this.idempLoad(old_session_id)
      if (hit) return hit
      await new Promise(r => setTimeout(r, 20))
      left -= 20
    }
    return null
  }

  async blockAllSessions(family_id: string, expires_at: Date) {
    const cacheKey = `auth:family:blocked:${family_id}`
    await this.cacheService.set(cacheKey, true, Math.max(expires_at.getTime() - Date.now(), 1000))
  }
}
