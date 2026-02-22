import { HttpStatus, Injectable, Logger } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { firstValueFrom } from 'rxjs'
import { PrismaService } from '../../../prisma.service'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { BindPotatoVNReqDto } from '../dto/req/bind-potatovn.req.dto'
import { PotatoVNBindingResDto } from '../dto/res/potatovn-binding.res.dto'
import { PvnLoginResponse } from '../interfaces/pvn-login-response.interface'
import { PotatoVNGameMappingService } from './potatovn-game-mapping.service'

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
  private readonly pvnBaseUrl: string

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly configService: ShionConfigService,
    private readonly potatovnGameMappingService: PotatoVNGameMappingService,
  ) {
    this.pvnBaseUrl = this.configService.get('potatovn.baseUrl')
  }

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

  /**
   * Refresh the PotatoVN token using the current stored token.
   * Call this before token expiry; PotatoVN provides GET /user/session/refresh.
   */
  async refreshToken(userId: number): Promise<void> {
    const binding = await this.prisma.userPvnBinding.findUnique({
      where: { user_id: userId },
      select: { pvn_token: true },
    })

    if (!binding) {
      throw new ShionBizException(
        ShionBizCode.PVN_BINDING_NOT_FOUND,
        'shion-biz.PVN_BINDING_NOT_FOUND',
        undefined,
        HttpStatus.NOT_FOUND,
      )
    }

    const pvnRes = await this.callPvnRefresh(binding.pvn_token)

    await this.prisma.userPvnBinding.update({
      where: { user_id: userId },
      data: {
        pvn_token: pvnRes.token,
        pvn_token_expires: new Date(pvnRes.expire * 1000),
      },
    })
  }

  private async loginPotatoVN(userName: string, password: string): Promise<PvnLoginResponse> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.post<PvnLoginResponse>(`${this.pvnBaseUrl}/user/session`, {
          userName,
          password,
        }),
      )
      return data
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

  private async callPvnRefresh(currentToken: string): Promise<PvnLoginResponse> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<PvnLoginResponse>(`${this.pvnBaseUrl}/user/session/refresh`, {
          headers: { Authorization: currentToken },
        }),
      )
      return data
    } catch (err) {
      this.logger.warn(`PotatoVN token refresh failed: ${err?.message}`)
      throw new ShionBizException(
        ShionBizCode.PVN_BINDING_AUTH_FAILED,
        'shion-biz.PVN_BINDING_AUTH_FAILED',
        undefined,
        HttpStatus.UNAUTHORIZED,
      )
    }
  }
}
