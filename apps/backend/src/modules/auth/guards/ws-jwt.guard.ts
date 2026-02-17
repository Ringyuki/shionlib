import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { WsException } from '@nestjs/websockets'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { CacheService } from '../../cache/services/cache.service'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { TokenPayloadInterface } from '../interfaces/token-payload.interface'

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ShionConfigService,
    private readonly cacheService: CacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient()
    const handshake = client.handshake || {}
    const headers = handshake.headers || {}
    const cookies = handshake.headers?.cookie
      ?.split(';')
      .map((c: string) => c.trim().split('='))
      .reduce((acc: Record<string, string>, [k, v]) => ((acc[k] = v), acc), {})

    const headerToken = this.extractBearer(headers['authorization'])
    const cookieToken = cookies?.['shionlib_access_token']
    const token = headerToken ?? cookieToken
    if (!token)
      throw new WsException({
        code: ShionBizCode.AUTH_UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })

    let payload: TokenPayloadInterface
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get('token.secret'),
      })
    } catch {
      throw new WsException({
        code: ShionBizCode.AUTH_UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }

    const blocked = await this.cacheService.get<boolean>(`auth:family:blocked:${payload.fid}`)
    if (blocked) {
      throw new WsException({
        code: ShionBizCode.AUTH_FAMILY_BLOCKED,
        status: HttpStatus.FORBIDDEN,
      })
    }

    client.data.user = payload
    return true
  }

  private extractBearer(authHeader?: string) {
    if (!authHeader) return undefined
    const [type, raw] = authHeader.split(' ')
    return type === 'Bearer' && raw ? raw.trim() : undefined
  }
}
