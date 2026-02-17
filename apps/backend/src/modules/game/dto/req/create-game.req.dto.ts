import {
  IsString,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  ValidateIf,
  IsEnum,
  IsNumber,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ivm, ivmEnum } from '../../../../common/validation/i18n'

export class CreateGameReqDto {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'b_id' }) })
  @IsOptional()
  b_id?: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'v_id' }) })
  @IsOptional()
  v_id?: string

  @ValidateIf(o => !o.title_zh && !o.title_en)
  @IsNotEmpty({
    message: ivm('validation.common.CANNOT_ALL_BE_EMPTY', {
      property: 'title_jp, title_zh, title_en',
    }),
  })
  title_jp?: string

  @ValidateIf(o => !o.title_jp && !o.title_en)
  @IsNotEmpty({
    message: ivm('validation.common.CANNOT_ALL_BE_EMPTY', {
      property: 'title_jp, title_zh, title_en',
    }),
  })
  title_zh?: string

  @ValidateIf(o => !o.title_jp && !o.title_zh)
  @IsNotEmpty({
    message: ivm('validation.common.CANNOT_ALL_BE_EMPTY', {
      property: 'title_jp, title_zh, title_en',
    }),
  })
  title_en?: string

  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'aliases' }) })
  @IsOptional()
  aliases?: string[]

  @ValidateIf(o => !o.intro_zh && !o.intro_en)
  @IsString({
    message: ivm('validation.common.CANNOT_ALL_BE_EMPTY', {
      property: 'intro_jp, intro_zh, intro_en',
    }),
  })
  intro_jp?: string

  @ValidateIf(o => !o.intro_jp && !o.intro_en)
  @IsString({
    message: ivm('validation.common.CANNOT_ALL_BE_EMPTY', {
      property: 'intro_jp, intro_zh, intro_en',
    }),
  })
  intro_zh?: string

  @ValidateIf(o => !o.intro_jp && !o.intro_zh)
  @IsString({
    message: ivm('validation.common.CANNOT_ALL_BE_EMPTY', {
      property: 'intro_jp, intro_zh, intro_en',
    }),
  })
  intro_en?: string

  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'extra_info' }) })
  @ValidateNested({ each: true })
  @Type(() => ExtraInfo)
  @IsOptional()
  extra_info?: ExtraInfo[]

  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'tags' }) })
  @IsOptional()
  tags?: string[]

  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'staffs' }) })
  @ValidateNested({ each: true })
  @Type(() => Staff)
  @IsOptional()
  staffs?: Staff[]

  @IsBoolean({ message: ivm('validation.common.IS_BOOLEAN', { property: 'nsfw' }) })
  @IsOptional()
  nsfw?: boolean

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'type' }) })
  @IsOptional()
  type?: string

  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'platform' }) })
  @IsOptional()
  platform?: string[]
}

export class Staff {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'name' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'name' }) })
  name: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'role' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'role' }) })
  role: string
}

export class ExtraInfo {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'key' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'key' }) })
  key: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'value' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'value' }) })
  value: string
}

enum GameCharacterGender {
  MALE = 'm',
  FEMALE = 'f',
  NON_BINARY = 'o',
  AMBIGUOUS = 'a',
}

enum GameCharacterRole {
  MAIN = 'main',
  PRIMARY = 'primary',
  SIDE = 'side',
  APPEARS = 'appears',
}

export class CreateGameCharacterReqDto {
  @ValidateNested({ each: true })
  @Type(() => GameCharacter)
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'characters' }) })
  characters: GameCharacter[]
}

export class GameCharacter {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'v_id' }) })
  @IsOptional()
  v_id?: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'b_id' }) })
  @IsOptional()
  b_id?: string

  @ValidateIf(o => !o.name_zh && !o.name_en)
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'name_jp' }) })
  @IsNotEmpty({
    message: ivm('validation.common.CANNOT_ALL_BE_EMPTY', {
      property: 'name_jp, name_zh, name_en',
    }),
  })
  name_jp: string

  @ValidateIf(o => !o.name_jp && !o.name_en)
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'name_zh' }) })
  @IsNotEmpty({
    message: ivm('validation.common.CANNOT_ALL_BE_EMPTY', {
      property: 'name_jp, name_zh, name_en',
    }),
  })
  name_zh?: string

  @ValidateIf(o => !o.name_jp && !o.name_zh)
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'name_en' }) })
  @IsNotEmpty({
    message: ivm('validation.common.CANNOT_ALL_BE_EMPTY', {
      property: 'name_jp, name_zh, name_en',
    }),
  })
  name_en?: string

  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'aliases' }) })
  @IsString({ each: true, message: ivm('validation.common.IS_STRING', { property: 'aliases' }) })
  @IsOptional()
  aliases?: string[]

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'intro_jp' }) })
  @IsOptional()
  intro_jp?: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'intro_zh' }) })
  @IsOptional()
  intro_zh?: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'intro_en' }) })
  @IsOptional()
  intro_en?: string

  @IsEnum(GameCharacterRole, {
    message: ivmEnum('validation.common.IS_ENUM', GameCharacterRole, {
      property: 'role',
    }),
  })
  @IsOptional()
  role?: GameCharacterRole

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'actor' }) })
  @IsOptional()
  actor?: string

  @IsEnum(GameCharacterGender, {
    message: ivmEnum('validation.common.IS_ENUM', GameCharacterGender, {
      property: 'gender',
    }),
  })
  @IsOptional()
  gender?: GameCharacterGender

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'image' }) })
  @IsOptional()
  image?: string

  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'extra_info' }) })
  @ValidateNested({ each: true })
  @Type(() => ExtraInfo)
  @IsOptional()
  extra_info?: ExtraInfo[]
}

export class CreateGameDeveloperReqDto {
  @ValidateNested({ each: true })
  @Type(() => GameDeveloper)
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'developers' }) })
  developers: GameDeveloper[]
}

export class GameDeveloper {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'v_id' }) })
  @IsOptional()
  v_id?: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'b_id' }) })
  @IsOptional()
  b_id?: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'name' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'name' }) })
  name: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'logo' }) })
  @IsOptional()
  logo?: string

  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'aliases' }) })
  @IsString({ each: true, message: ivm('validation.common.IS_STRING', { property: 'aliases' }) })
  @IsOptional()
  aliases?: string[]

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'intro_jp' }) })
  @IsOptional()
  intro_jp?: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'intro_zh' }) })
  @IsOptional()
  intro_zh?: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'intro_en' }) })
  @IsOptional()
  intro_en?: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'role' }) })
  @IsOptional()
  role?: string

  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'extra_info' }) })
  @ValidateNested({ each: true })
  @Type(() => ExtraInfo)
  @IsOptional()
  extra_info?: ExtraInfo[]
}

export enum GameCoverLanguage {
  JA = 'jp',
  ZH = 'zh',
  EN = 'en',
}

export enum GameCoverType {
  DIG = 'dig',
  PKGFRONT = 'pkgfront',
}

export class CreateGameCoverReqDto {
  @ValidateNested({ each: true })
  @Type(() => GameCover)
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'covers' }) })
  covers: GameCover[]
}

export class GameCover {
  @IsEnum(GameCoverLanguage, {
    message: ivmEnum('validation.common.IS_ENUM', GameCoverLanguage, {
      property: 'language',
    }),
  })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'language' }) })
  language: GameCoverLanguage

  @IsEnum(GameCoverType, {
    message: ivmEnum('validation.common.IS_ENUM', GameCoverType, {
      property: 'type',
    }),
  })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'type' }) })
  type: GameCoverType

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'url' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'url' }) })
  url: string

  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'dims' }) })
  @IsNumber({}, { each: true, message: ivm('validation.common.IS_NUMBER', { property: 'dims' }) })
  @IsOptional()
  dims?: number[]
}
