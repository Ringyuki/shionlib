import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsArray,
  MaxLength,
  IsDateString,
} from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'

export class CreateAdReqDto {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'name' }) })
  @MaxLength(100)
  name: string

  @IsArray()
  @IsString({ each: true })
  placement: string[]

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'image_zh' }) })
  @MaxLength(500)
  image_zh: string

  @IsOptional()
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'image_ja' }) })
  @MaxLength(500)
  image_ja?: string

  @IsOptional()
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'image_en' }) })
  @MaxLength(500)
  image_en?: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'aspect' }) })
  @MaxLength(20)
  aspect: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'link' }) })
  @MaxLength(500)
  link: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  exclude_locales?: string[]

  @IsOptional()
  @IsBoolean()
  enabled?: boolean

  @IsOptional()
  @IsInt()
  sort?: number

  @IsOptional()
  @IsDateString()
  start_at?: string

  @IsOptional()
  @IsDateString()
  end_at?: string
}
