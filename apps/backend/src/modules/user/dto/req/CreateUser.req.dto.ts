import {
  IsString,
  IsEmail,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
  IsUUID,
  IsOptional,
  IsEnum,
} from 'class-validator'
import { ivm, ivmEnum } from '../../../../common/validation/i18n'

enum UserLang {
  EN = 'en',
  ZH = 'zh',
  JA = 'ja',
}

export class CreateUserDto {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'name' }) })
  @IsNotEmpty({
    message: ivm('validation.common.IS_NOT_EMPTY', { property: 'name' }),
  })
  @MinLength(2, {
    message: ivm('validation.common.MIN_LENGTH', { property: 'name', min: 2 }),
  })
  @MaxLength(20, {
    message: ivm('validation.common.MAX_LENGTH', { property: 'name', max: 20 }),
  })
  name: string

  @IsEmail({}, { message: ivm('validation.common.IS_EMAIL', { property: 'email' }) })
  @IsNotEmpty({
    message: ivm('validation.common.IS_NOT_EMPTY', { property: 'email' }),
  })
  email: string

  @IsString({
    message: ivm('validation.common.IS_STRING', { property: 'password' }),
  })
  @IsNotEmpty({
    message: ivm('validation.common.IS_NOT_EMPTY', { property: 'password' }),
  })
  @MinLength(8, {
    message: ivm('validation.common.MIN_LENGTH', {
      property: 'password',
      min: 8,
    }),
  })
  @MaxLength(50, {
    message: ivm('validation.common.MAX_LENGTH', {
      property: 'password',
      max: 50,
    }),
  })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message: ivm('validation.user.PASSWORD_MATCHES'),
  })
  password: string

  @IsEnum(UserLang, {
    message: ivmEnum('validation.common.IS_ENUM', UserLang, { property: 'lang' }),
  })
  @IsOptional()
  lang?: UserLang

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'code' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'code' }) })
  code: string

  @IsUUID(4, { message: ivm('validation.common.IS_UUID', { property: 'uuid' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'uuid' }) })
  uuid: string
}
