import { Injectable, ExecutionContext } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { TokenPayloadInterface } from '../interfaces/token-payload.interface'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'

const GUEST_USER: TokenPayloadInterface = {
  sub: 0,
  role: ShionlibUserRoles.USER,
  content_limit: 0,
  type: 'access',
}

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await super.canActivate(context)
    } catch {
      /* empty */
    }
    return true
  }

  handleRequest<T>(_err: any, user: T, _info: any, context: ExecutionContext): T {
    const req = context.switchToHttp().getRequest<RequestWithUser>()
    const hasProvidedToken = this.hasProvidedAccessToken(req)
    if (!user && hasProvidedToken) {
      req.auth = {
        optionalTokenStale: true,
        optionalTokenReason: this.resolveTokenIssue(_info),
      }
    } else {
      req.auth = {
        optionalTokenStale: false,
      }
    }
    req.user = (user || GUEST_USER) as TokenPayloadInterface
    return req.user as T
  }

  private hasProvidedAccessToken(req: RequestWithUser): boolean {
    const auth = req.headers.authorization?.trim()
    const headerToken = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : ''
    const cookieToken = req.cookies?.['shionlib_access_token']?.trim() ?? ''
    return Boolean(
      (headerToken && headerToken !== 'undefined' && headerToken !== 'null') || cookieToken,
    )
  }

  private resolveTokenIssue(info: unknown): string {
    if (typeof info === 'string' && info) {
      return info
    }
    if (Array.isArray(info)) {
      const first = info.find(Boolean)
      if (typeof first === 'string') return first
      if (first instanceof Error && first.name) return first.name
      if (first && typeof first === 'object' && 'message' in first) {
        const message = (first as { message?: unknown }).message
        return typeof message === 'string' && message ? message : 'invalid_token'
      }
    }
    if (info instanceof Error) {
      return info.name || info.message || 'invalid_token'
    }
    if (info && typeof info === 'object' && 'message' in info) {
      const message = (info as { message?: unknown }).message
      if (typeof message === 'string' && message) return message
    }
    return 'invalid_token'
  }
}
