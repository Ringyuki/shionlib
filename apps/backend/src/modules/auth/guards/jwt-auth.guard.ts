import { Injectable, ExecutionContext, HttpStatus } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthGuard } from '@nestjs/passport'
import { JwtService } from '@nestjs/jwt'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { CacheService } from '../../cache/services/cache.service'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ShionConfigService,
    private readonly cacheService: CacheService,
    private readonly reflector: Reflector,
  ) {
    super()
  }
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true
    const request = context.switchToHttp().getRequest<RequestWithUser>()
    const headerToken = this.extractTokenFromHeader(request)
    const cookieToken = this.extractTokenFromCookie(request)
    const token = headerToken ?? cookieToken
    if (!token) {
      throw new ShionBizException(
        ShionBizCode.AUTH_UNAUTHORIZED,
        'shion-biz.AUTH_UNAUTHORIZED',
        undefined,
        HttpStatus.UNAUTHORIZED,
      )
    }

    try {
      const payload = (await this.jwtService.verifyAsync(token, {
        secret: this.configService.get('token.secret'),
      })) as RequestWithUser['user']
      request.user = payload

      const cacheKey = `auth:family:blocked:${payload.fid}`
      const blocked = await this.cacheService.get<boolean>(cacheKey)
      if (blocked) {
        throw new ShionBizException(
          ShionBizCode.AUTH_FAMILY_BLOCKED,
          'shion-biz.AUTH_FAMILY_BLOCKED',
          undefined,
          HttpStatus.FORBIDDEN,
        )
      }
      return true
    } catch (error) {
      if (error instanceof ShionBizException) {
        if (error.code === ShionBizCode.AUTH_FAMILY_BLOCKED) {
          throw new ShionBizException(
            ShionBizCode.AUTH_FAMILY_BLOCKED,
            'shion-biz.AUTH_FAMILY_BLOCKED',
            undefined,
            HttpStatus.FORBIDDEN,
          )
        }
      }
      throw new ShionBizException(
        ShionBizCode.AUTH_UNAUTHORIZED,
        'shion-biz.AUTH_UNAUTHORIZED',
        undefined,
        HttpStatus.UNAUTHORIZED,
      )
    }
  }

  private extractTokenFromHeader(request: RequestWithUser): string | undefined {
    const auth = request.headers.authorization?.trim()
    if (!auth) return undefined
    const [type, raw] = auth.split(' ')
    const candidate = raw?.trim()
    return type === 'Bearer' && candidate && candidate !== 'undefined' && candidate !== 'null'
      ? candidate
      : undefined
  }

  private extractTokenFromCookie(request: RequestWithUser): string | undefined {
    if (request.cookies) {
      if (request.cookies['shionlib_access_token']) {
        return request.cookies['shionlib_access_token']
      }
    }
    return undefined
  }
}
