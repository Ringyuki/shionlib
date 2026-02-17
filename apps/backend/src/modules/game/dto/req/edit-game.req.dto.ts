import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsDate,
  IsNumber,
  IsNotEmpty,
  IsEnum,
  Max,
  Min,
  ArrayMaxSize,
  ArrayMinSize,
  MaxLength,
} from 'class-validator'
import { ExtraInfo, Staff } from './create-game.req.dto'
import { ivm, ivmEnum } from '../../../../common/validation/i18n'
import { Type } from 'class-transformer'
import { GameCoverLanguage, GameCoverType } from './create-game.req.dto'

enum GamePlatformEnum {
  WINDOWS = 'win',
  IOS = 'ios',
  ANDROID = 'and',
  LINUX = 'lin',
  MAC = 'mac',
  PS3 = 'ps3',
  PS4 = 'ps4',
  PSV = 'psv',
  PSP = 'psp',
  SWI = 'swi',
  DVD = 'dvd',
  PS2 = 'ps2',
  MOB = 'mob',
  WEB = 'web',
  VND = 'vnd',
  DRC = 'drc',
  GBC = 'gbc',
  GBA = 'gba',
  NDS = 'nds',
}

export class EditGameReqDto {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'b_id' }) })
  @IsOptional()
  b_id?: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'v_id' }) })
  @IsOptional()
  v_id?: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'title_jp' }) })
  @IsOptional()
  title_jp?: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'title_zh' }) })
  @IsOptional()
  title_zh?: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'title_en' }) })
  @IsOptional()
  title_en?: string

  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'aliases' }) })
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
  @IsEnum(GamePlatformEnum, {
    each: true,
    message: ivmEnum('validation.common.IS_ENUM', GamePlatformEnum, {
      property: 'platform',
    }),
  })
  @IsOptional()
  platform?: string[]

  @IsDate({ message: ivm('validation.common.IS_DATE', { property: 'release_date' }) })
  @Type(() => Date)
  @IsOptional()
  release_date?: string

  @IsBoolean({ message: ivm('validation.common.IS_BOOLEAN', { property: 'release_date_tba' }) })
  @IsOptional()
  release_date_tba?: boolean

  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: ivm('validation.common.IS_NUMBER', { property: 'views' }) },
  )
  @IsOptional()
  views?: number

  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: ivm('validation.common.IS_NUMBER', { property: 'status' }) },
  )
  @Min(1, { message: ivm('validation.common.MIN', { property: 'status' }) })
  @Max(2, { message: ivm('validation.common.MAX', { property: 'status' }) })
  @IsOptional()
  status?: number

  @IsOptional()
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'note' }) })
  @MaxLength(255, { message: ivm('validation.common.MAX_LENGTH', { property: 'note', max: 255 }) })
  note?: string
}

export class GameLinkDto {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'url' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'url' }) })
  url: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'label' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'label' }) })
  label: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'name' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'name' }) })
  name: string
}

export class EditGameLinkDto extends GameLinkDto {
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: ivm('validation.common.IS_NUMBER', { property: 'id' }) },
  )
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'id' }) })
  id: number
}

export class EditGameLinkReqDto {
  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'links' }) })
  @ValidateNested({ each: true })
  @Type(() => EditGameLinkDto)
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'links' }) })
  links: EditGameLinkDto[]
}

export class AddGameLinkReqDto {
  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'links' }) })
  @ValidateNested({ each: true })
  @Type(() => GameLinkDto)
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'links' }) })
  links: GameLinkDto[]
}

export class RemoveGameLinkReqDto {
  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'ids' }) })
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: ivm('validation.common.IS_NUMBER', { property: 'ids' }), each: true },
  )
  @Type(() => Number)
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'ids' }) })
  ids: number[]
}

export class GameCoverDto {
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
  @ArrayMaxSize(2, { message: ivm('validation.common.ARRAY_MAX_SIZE', { property: 'dims' }) })
  @ArrayMinSize(2, { message: ivm('validation.common.ARRAY_MIN_SIZE', { property: 'dims' }) })
  @IsNumber({}, { each: true, message: ivm('validation.common.IS_NUMBER', { property: 'dims' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'dims' }) })
  dims: number[]

  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: ivm('validation.common.IS_NUMBER', { property: 'sexual' }) },
  )
  @Max(2, { message: ivm('validation.common.MAX', { property: 'sexual', max: 2 }) })
  @Min(0, { message: ivm('validation.common.MIN', { property: 'sexual', min: 0 }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'sexual' }) })
  sexual: number

  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: ivm('validation.common.IS_NUMBER', { property: 'violence' }) },
  )
  @Max(2, { message: ivm('validation.common.MAX', { property: 'violence', max: 2 }) })
  @Min(0, { message: ivm('validation.common.MIN', { property: 'violence', min: 0 }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'violence' }) })
  violence: number
}

export class EditGameCoverDto extends GameCoverDto {
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: ivm('validation.common.IS_NUMBER', { property: 'id' }) },
  )
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'id' }) })
  id: number
}

export class EditGameCoverReqDto {
  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'covers' }) })
  @ValidateNested({ each: true })
  @Type(() => EditGameCoverDto)
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'covers' }) })
  covers: EditGameCoverDto[]
}

export class AddGameCoverReqDto {
  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'covers' }) })
  @ValidateNested({ each: true })
  @Type(() => GameCoverDto)
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'covers' }) })
  covers: GameCoverDto[]
}

export class RemoveGameCoverReqDto {
  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'ids' }) })
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: ivm('validation.common.IS_NUMBER', { property: 'ids' }), each: true },
  )
  @Type(() => Number)
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'ids' }) })
  ids: number[]
}

export class GameImageDto {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'url' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'url' }) })
  url: string

  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'dims' }) })
  @ArrayMaxSize(2, { message: ivm('validation.common.ARRAY_MAX_SIZE', { property: 'dims' }) })
  @ArrayMinSize(2, { message: ivm('validation.common.ARRAY_MIN_SIZE', { property: 'dims' }) })
  @IsNumber({}, { each: true, message: ivm('validation.common.IS_NUMBER', { property: 'dims' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'dims' }) })
  dims: number[]

  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: ivm('validation.common.IS_NUMBER', { property: 'sexual' }) },
  )
  @Max(2, { message: ivm('validation.common.MAX', { property: 'sexual', max: 2 }) })
  @Min(0, { message: ivm('validation.common.MIN', { property: 'sexual', min: 0 }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'sexual' }) })
  sexual: number

  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: ivm('validation.common.IS_NUMBER', { property: 'violence' }) },
  )
  @Max(2, { message: ivm('validation.common.MAX', { property: 'violence', max: 2 }) })
  @Min(0, { message: ivm('validation.common.MIN', { property: 'violence', min: 0 }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'violence' }) })
  violence: number
}

export class EditGameImageDto extends GameImageDto {
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: ivm('validation.common.IS_NUMBER', { property: 'id' }) },
  )
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'id' }) })
  id: number
}

export class EditGameImageReqDto {
  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'images' }) })
  @ValidateNested({ each: true })
  @Type(() => EditGameImageDto)
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'images' }) })
  images: EditGameImageDto[]
}

export class AddGameImageReqDto {
  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'images' }) })
  @ValidateNested({ each: true })
  @Type(() => GameImageDto)
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'images' }) })
  images: GameImageDto[]
}

export class RemoveGameImageReqDto {
  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'ids' }) })
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: ivm('validation.common.IS_NUMBER', { property: 'ids' }), each: true },
  )
  @Type(() => Number)
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'ids' }) })
  ids: number[]
}

export class GameDeveloperRelationDto {
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: ivm('validation.common.IS_NUMBER', { property: 'developer_id' }) },
  )
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'developer_id' }) })
  developer_id: number

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'role' }) })
  @IsOptional()
  role?: string
}

export class AddGameDeveloperReqDto {
  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'developers' }) })
  @ValidateNested({ each: true })
  @Type(() => GameDeveloperRelationDto)
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'developers' }) })
  developers: GameDeveloperRelationDto[]
}

export class EditGameDeveloperDto extends GameDeveloperRelationDto {
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: ivm('validation.common.IS_NUMBER', { property: 'id' }) },
  )
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'id' }) })
  id: number
}

export class EditGameDeveloperReqDto {
  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'developers' }) })
  @ValidateNested({ each: true })
  @Type(() => EditGameDeveloperDto)
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'developers' }) })
  developers: EditGameDeveloperDto[]
}

export class RemoveGameDeveloperReqDto {
  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'ids' }) })
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: ivm('validation.common.IS_NUMBER', { property: 'ids' }), each: true },
  )
  @Type(() => Number)
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'ids' }) })
  ids: number[]
}

export enum GameCharacterRole {
  MAIN = 'main',
  PRIMARY = 'primary',
  SIDE = 'side',
  APPEARS = 'appears',
}

export class GameCharacterRelationDto {
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: ivm('validation.common.IS_NUMBER', { property: 'character_id' }) },
  )
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'character_id' }) })
  character_id: number

  @IsEnum(GameCharacterRole, {
    message: ivmEnum('validation.common.IS_ENUM', { property: 'role' }),
  })
  @IsOptional()
  role?: GameCharacterRole

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'image' }) })
  @IsOptional()
  image?: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'actor' }) })
  @IsOptional()
  actor?: string
}

export class AddGameCharacterReqDto {
  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'characters' }) })
  @ValidateNested({ each: true })
  @Type(() => GameCharacterRelationDto)
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'characters' }) })
  characters: GameCharacterRelationDto[]
}

export class EditGameCharacterDto extends GameCharacterRelationDto {
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: ivm('validation.common.IS_NUMBER', { property: 'id' }) },
  )
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'id' }) })
  id: number
}

export class EditGameCharacterReqDto {
  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'characters' }) })
  @ValidateNested({ each: true })
  @Type(() => EditGameCharacterDto)
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'characters' }) })
  characters: EditGameCharacterDto[]
}

export class RemoveGameCharacterReqDto {
  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'ids' }) })
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: ivm('validation.common.IS_NUMBER', { property: 'ids' }), each: true },
  )
  @Type(() => Number)
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'ids' }) })
  ids: number[]
}
