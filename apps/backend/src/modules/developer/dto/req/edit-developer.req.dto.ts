import { IsString, IsOptional, IsArray, ValidateNested, MaxLength } from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'
import { Type } from 'class-transformer'

class ExtraInfo {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'key' }) })
  key: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'value' }) })
  value: string
}

export class EditDeveloperReqDto {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'b_id' }) })
  @IsOptional()
  b_id?: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'v_id' }) })
  @IsOptional()
  v_id?: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'name' }) })
  @MaxLength(255, { message: ivm('validation.common.MAX_LENGTH', { property: 'name', max: 255 }) })
  @IsOptional()
  name?: string

  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'aliases' }) })
  @IsString({ each: true, message: ivm('validation.common.IS_STRING', { property: 'aliases' }) })
  @IsOptional()
  aliases?: string[]

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'intro_jp' }) })
  @MaxLength(20000, {
    message: ivm('validation.common.MAX_LENGTH', { property: 'intro_jp', max: 20000 }),
  })
  @IsOptional()
  intro_jp?: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'intro_zh' }) })
  @MaxLength(20000, {
    message: ivm('validation.common.MAX_LENGTH', { property: 'intro_zh', max: 20000 }),
  })
  @IsOptional()
  intro_zh?: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'intro_en' }) })
  @MaxLength(20000, {
    message: ivm('validation.common.MAX_LENGTH', { property: 'intro_en', max: 20000 }),
  })
  @IsOptional()
  intro_en?: string

  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'extra_info' }) })
  @ValidateNested({ each: true })
  @Type(() => ExtraInfo)
  @IsOptional()
  extra_info?: ExtraInfo[]

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'logo' }) })
  @IsOptional()
  logo?: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'website' }) })
  @IsOptional()
  website?: string

  @IsOptional()
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'note' }) })
  @MaxLength(255, { message: ivm('validation.common.MAX_LENGTH', { property: 'note', max: 255 }) })
  note?: string
}
