import { IsEnum } from 'class-validator'
import { PermissionEntity } from '../../enums/permission-entity.enum'
import { ivmEnum } from '../../../../common/validation/i18n'

export class GetPermissionsReqDto {
  @IsEnum(PermissionEntity, {
    message: ivmEnum('validation.common.IS_ENUM', PermissionEntity, { property: 'entity' }),
  })
  entity: PermissionEntity
}
