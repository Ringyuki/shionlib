import { HttpStatus, Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { BindPotatoVNReqDto } from '../dto/req/bind-potatovn.req.dto'
import { PotatoVNBindingResDto } from '../dto/res/potatovn-binding.res.dto'
import { PvnLoginResponse } from '../interfaces/pvn-login-response.interface'
import { PotatoVNGameMappingService } from './potatovn-game-mapping.service'
import { PvnApiService } from './pvn-api.service'

const PVN_BINDING_SELECT = {
  pvn_user_id: true,
  pvn_user_name: true,
  pvn_user_avatar: true,
  pvn_token_expires: true,
  created: true,
  updated: true,
} as const

@Injectable()
export class PotatoVNBindingService {
  private readonly logger = new Logger(PotatoVNBindingService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly pvnApi: PvnApiService,
    private readonly potatovnGameMappingService: PotatoVNGameMappingService,
  ) {}

  async getBinding(userId: number): Promise<PotatoVNBindingResDto> {
    const binding = await this.prisma.userPvnBinding.findUnique({
      where: { user_id: userId },
      select: PVN_BINDING_SELECT,
    })

    if (!binding) {
      throw new ShionBizException(
        ShionBizCode.PVN_BINDING_NOT_FOUND,
        'shion-biz.PVN_BINDING_NOT_FOUND',
        undefined,
        HttpStatus.NOT_FOUND,
      )
    }

    return binding
  }

  async bind(userId: number, dto: BindPotatoVNReqDto): Promise<PotatoVNBindingResDto> {
    const existing = await this.prisma.userPvnBinding.findUnique({
      where: { user_id: userId },
      select: { id: true },
    })

    if (existing) {
      throw new ShionBizException(
        ShionBizCode.PVN_BINDING_ALREADY_EXISTS,
        'shion-biz.PVN_BINDING_ALREADY_EXISTS',
      )
    }

    const pvnRes = await this.loginPotatoVN(dto.pvn_user_name, dto.pvn_password)

    const result = await this.prisma.userPvnBinding.create({
      data: {
        user_id: userId,
        pvn_user_id: pvnRes.user.id,
        pvn_user_name: pvnRes.user.userName,
        pvn_token: pvnRes.token,
        pvn_token_expires: new Date(pvnRes.expire * 1000),
      },
      select: PVN_BINDING_SELECT,
    })

    void this.potatovnGameMappingService.syncLibrary(userId)

    return result
  }

  async unbind(userId: number): Promise<void> {
    const binding = await this.prisma.userPvnBinding.findUnique({
      where: { user_id: userId },
      select: { id: true },
    })

    if (!binding) {
      throw new ShionBizException(
        ShionBizCode.PVN_BINDING_NOT_FOUND,
        'shion-biz.PVN_BINDING_NOT_FOUND',
        undefined,
        HttpStatus.NOT_FOUND,
      )
    }

    await this.prisma.userPvnBinding.delete({ where: { user_id: userId } })
    await this.prisma.userGamePvnMapping.deleteMany({ where: { user_id: userId } })
  }

  async refreshToken(userId: number): Promise<void> {
    try {
      const pvnRes = await this.pvnApi.get<PvnLoginResponse>(userId, '/user/session/refresh')
      await this.prisma.userPvnBinding.update({
        where: { user_id: userId },
        data: {
          pvn_token: pvnRes.token,
          pvn_token_expires: new Date(pvnRes.expire * 1000),
        },
      })
    } catch (err) {
      this.logger.warn(`PotatoVN token refresh failed for userId=${userId}: ${err?.message}`)
      throw new ShionBizException(
        ShionBizCode.PVN_BINDING_AUTH_FAILED,
        'shion-biz.PVN_BINDING_AUTH_FAILED',
        undefined,
        HttpStatus.UNAUTHORIZED,
      )
    }
  }

  private async loginPotatoVN(userName: string, password: string): Promise<PvnLoginResponse> {
    try {
      return await this.pvnApi.postPublic<PvnLoginResponse>('/user/session', { userName, password })
    } catch (err) {
      this.logger.warn(`PotatoVN login failed for user "${userName}": ${err?.message}`)
      throw new ShionBizException(
        ShionBizCode.PVN_BINDING_AUTH_FAILED,
        'shion-biz.PVN_BINDING_AUTH_FAILED',
        undefined,
        HttpStatus.UNAUTHORIZED,
      )
    }
  }
}
