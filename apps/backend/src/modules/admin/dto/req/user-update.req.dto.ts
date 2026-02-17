import { IsOptional, IsString, MinLength, MaxLength, IsEmail, IsIn, IsInt } from 'class-validator'
import { Type } from 'class-transformer'
import { UserLang } from '../../../user/interfaces/user.interface'

export class AdminUpdateUserProfileReqDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  name?: string

  @IsOptional()
  @IsEmail()
  email?: string

  @IsOptional()
  @IsIn(Object.values(UserLang))
  lang?: UserLang

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([1, 2, 3])
  content_limit?: number
}

export class AdminUpdateUserRoleReqDto {
  @Type(() => Number)
  @IsInt()
  @IsIn([1, 2, 3])
  role: number
}
