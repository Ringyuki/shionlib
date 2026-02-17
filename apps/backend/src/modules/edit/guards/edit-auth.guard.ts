import { CanActivate, ExecutionContext, Injectable, Type, mixin } from '@nestjs/common'
import { PermissionService } from '../services/permission.service'
import { PermissionEntity } from '../enums/permission-entity.enum'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'

export const EditAuthGuard = (
  entity: PermissionEntity,
  resolveBits: (dto: any) => number[],
  keyToBit?: Record<string, number>,
  relationKey?: string,
): Type<CanActivate> => {
  @Injectable()
  class EditAuthGuardMixin implements CanActivate {
    constructor(private readonly perms: PermissionService) {}

    async canActivate(ctx: ExecutionContext): Promise<boolean> {
      const req = ctx.switchToHttp().getRequest()
      const user = req.user as RequestWithUser['user']
      const dto = req.body

      const bits = resolveBits(dto)
      if (bits.length === 0) return true

      const allowMask: bigint = await this.perms.getAllowMaskFor(user.sub, user.role, entity)
      const deniedBits = bits.filter(b => (allowMask & (1n << BigInt(b))) === 0n)
      if (deniedBits.length > 0) {
        const deniedFields = keyToBit
          ? Object.keys(dto).filter(k => deniedBits.includes(keyToBit[k] as number))
          : relationKey

        throw new ShionBizException(
          ShionBizCode.EDIT_FIELD_PERMISSION_NOT_ENOUGH,
          undefined,
          { deniedBits, deniedFields },
          undefined,
        )
      }
      return true
    }
  }
  return mixin(EditAuthGuardMixin)
}
