import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'
import { ROLES_KEY } from '../decorators/roles.decorator'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<ShionlibUserRoles[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!requiredRoles) {
      return true
    }

    const { user }: RequestWithUser = context.switchToHttp().getRequest()
    if (!requiredRoles.includes(ShionlibUserRoles.SUPER_ADMIN)) {
      return requiredRoles.some(role => user.role >= role)
    } else {
      return user.role === ShionlibUserRoles.SUPER_ADMIN
    }
  }
}
