import { IsString, IsOptional, IsArray, IsInt, IsEnum, MaxLength, Min, Max } from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'

export enum GameCharacterBloodType {
  A = 'a',
  B = 'b',
  AB = 'ab',
  O = 'o',
}

export enum GameCharacterGender {
  Male = 'm',
  Female = 'f',
  Other = 'o',
  Asexual = 'a',
}

export class EditCharacterReqDto {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'b_id' }) })
  @IsOptional()
  b_id?: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'v_id' }) })
  @IsOptional()
  v_id?: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'name_jp' }) })
  @MaxLength(255, {
    message: ivm('validation.common.MAX_LENGTH', { property: 'name_jp', max: 255 }),
  })
  @IsOptional()
  name_jp?: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'name_zh' }) })
  @MaxLength(255, {
    message: ivm('validation.common.MAX_LENGTH', { property: 'name_zh', max: 255 }),
  })
  @IsOptional()
  name_zh?: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'name_en' }) })
  @MaxLength(255, {
    message: ivm('validation.common.MAX_LENGTH', { property: 'name_en', max: 255 }),
  })
  @IsOptional()
  name_en?: string

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

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'image' }) })
  @IsOptional()
  image?: string

  @IsEnum(GameCharacterBloodType, {
    message: ivm('validation.common.IS_ENUM', { property: 'blood_type' }),
  })
  @IsOptional()
  blood_type?: GameCharacterBloodType

  @IsInt({ message: ivm('validation.common.IS_INT', { property: 'height' }) })
  @Min(0, { message: ivm('validation.common.MIN', { property: 'height', min: 0 }) })
  @Max(500, { message: ivm('validation.common.MAX', { property: 'height', max: 500 }) })
  @IsOptional()
  height?: number

  @IsInt({ message: ivm('validation.common.IS_INT', { property: 'weight' }) })
  @Min(0, { message: ivm('validation.common.MIN', { property: 'weight', min: 0 }) })
  @Max(500, { message: ivm('validation.common.MAX', { property: 'weight', max: 500 }) })
  @IsOptional()
  weight?: number

  @IsInt({ message: ivm('validation.common.IS_INT', { property: 'bust' }) })
  @Min(0, { message: ivm('validation.common.MIN', { property: 'bust', min: 0 }) })
  @Max(300, { message: ivm('validation.common.MAX', { property: 'bust', max: 300 }) })
  @IsOptional()
  bust?: number

  @IsInt({ message: ivm('validation.common.IS_INT', { property: 'waist' }) })
  @Min(0, { message: ivm('validation.common.MIN', { property: 'waist', min: 0 }) })
  @Max(300, { message: ivm('validation.common.MAX', { property: 'waist', max: 300 }) })
  @IsOptional()
  waist?: number

  @IsInt({ message: ivm('validation.common.IS_INT', { property: 'hips' }) })
  @Min(0, { message: ivm('validation.common.MIN', { property: 'hips', min: 0 }) })
  @Max(300, { message: ivm('validation.common.MAX', { property: 'hips', max: 300 }) })
  @IsOptional()
  hips?: number

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'cup' }) })
  @MaxLength(10, { message: ivm('validation.common.MAX_LENGTH', { property: 'cup', max: 10 }) })
  @IsOptional()
  cup?: string

  @IsInt({ message: ivm('validation.common.IS_INT', { property: 'age' }) })
  @Min(0, { message: ivm('validation.common.MIN', { property: 'age', min: 0 }) })
  @Max(10000, { message: ivm('validation.common.MAX', { property: 'age', max: 10000 }) })
  @IsOptional()
  age?: number

  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'birthday' }) })
  @IsInt({ each: true, message: ivm('validation.common.IS_INT', { property: 'birthday' }) })
  @IsOptional()
  birthday?: number[]

  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'gender' }) })
  @IsEnum(GameCharacterGender, {
    each: true,
    message: ivm('validation.common.IS_ENUM', { property: 'gender' }),
  })
  @IsOptional()
  gender?: GameCharacterGender[]

  @IsOptional()
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'note' }) })
  @MaxLength(255, { message: ivm('validation.common.MAX_LENGTH', { property: 'note', max: 255 }) })
  note?: string
}
