import { IsArray, ArrayUnique, IsInt, IsOptional, IsEnum } from 'class-validator'
import { Type } from 'class-transformer'
import { PermissionEntity } from '../../../edit/enums/permission-entity.enum'

export class AdminUserPermissionsReqDto {
  @IsEnum(PermissionEntity)
  entity: PermissionEntity
}

export class AdminUpdateUserPermissionsReqDto {
  @IsEnum(PermissionEntity)
  entity: PermissionEntity

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  allowBits?: number[]
}
