export interface Permission<F, S, R> {
  allowMask: string
  fields: {
    [key in keyof F]: boolean
  }
  scalarFields: S[]
  relationFields: R[]
}

export interface GamePermission
  extends Permission<GameFields, GameScalarFields, GameRelationFields> {}
export interface DeveloperPermission
  extends Permission<DeveloperFields, DeveloperScalarFields, DeveloperRelationFields> {}
export interface CharacterPermission
  extends Permission<CharacterFields, CharacterScalarFields, CharacterRelationFields> {}

export type GamePermissionFields =
  | 'v_id'
  | 'b_id'
  | 'title_jp'
  | 'title_zh'
  | 'title_en'
  | 'intro_jp'
  | 'intro_zh'
  | 'intro_en'
  | 'aliases'
  | 'release_date'
  | 'release_date_tba'
  | 'type'
  | 'platform'
  | 'extra_info'
  | 'tags'
  | 'staffs'
  | 'links'
  | 'covers'
  | 'images'
  | 'developers'
  | 'characters'
  | 'status'
  | 'nsfw'
  | 'views'
export type DeveloperPermissionFields =
  | 'v_id'
  | 'b_id'
  | 'name'
  | 'aliases'
  | 'intro_jp'
  | 'intro_zh'
  | 'intro_en'
  | 'extra_info'
  | 'logo'
  | 'website'
export type CharacterPermissionFields =
  | 'v_id'
  | 'b_id'
  | 'name_jp'
  | 'name_zh'
  | 'name_en'
  | 'intro_jp'
  | 'intro_zh'
  | 'intro_en'
  | 'aliases'
  | 'image'
  | 'blood_type'
  | 'height'
  | 'weight'
  | 'bust'
  | 'waist'
  | 'hips'
  | 'cup'
  | 'age'
  | 'birthday'
  | 'gender'

export const GamePermissionFieldsArray: Array<GamePermissionFields> = [
  'v_id',
  'b_id',
  'title_jp',
  'title_zh',
  'title_en',
  'intro_jp',
  'intro_zh',
  'intro_en',
  'aliases',
  'release_date',
  'release_date_tba',
  'type',
  'platform',
  'extra_info',
  'tags',
  'staffs',
  'links',
  'covers',
  'images',
  'developers',
  'characters',
  'status',
  'nsfw',
  'views',
]
export const DeveloperPermissionFieldsArray: Array<DeveloperPermissionFields> = [
  'v_id',
  'b_id',
  'name',
  'aliases',
  'intro_jp',
  'intro_zh',
  'intro_en',
  'extra_info',
  'logo',
  'website',
]
export const CharacterPermissionFieldsArray: Array<CharacterPermissionFields> = [
  'v_id',
  'b_id',
  'name_jp',
  'name_zh',
  'name_en',
  'intro_jp',
  'intro_zh',
  'intro_en',
  'aliases',
  'image',
  'blood_type',
  'height',
  'weight',
  'bust',
  'waist',
  'hips',
  'cup',
  'age',
  'birthday',
  'gender',
]

export type GameScalarFields =
  | 'IDS'
  | 'TITLES'
  | 'INTROS'
  | 'ALIASES'
  | 'RELEASE'
  | 'TYPE'
  | 'PLATFORMS'
  | 'EXTRA'
  | 'TAGS'
  | 'STAFFS'
  | 'STATUS'
  | 'NSFW'
  | 'VIEWS'
export type DeveloperScalarFields =
  | 'IDS'
  | 'NAME'
  | 'ALIASES'
  | 'INTROS'
  | 'EXTRA'
  | 'LOGO'
  | 'WEBSITE'
export type CharacterScalarFields =
  | 'IDS'
  | 'NAMES'
  | 'INTROS'
  | 'ALIASES'
  | 'IMAGE'
  | 'BODY_METRICS'
  | 'AGE_BIRTHDAY'
  | 'BLOOD_TYPE'
  | 'GENDER'

export type GameRelationFields =
  | 'MANAGE_LINKS'
  | 'MANAGE_COVERS'
  | 'MANAGE_IMAGES'
  | 'MANAGE_DEVELOPERS'
  | 'MANAGE_CHARACTERS'
export type DeveloperRelationFields = []
export type CharacterRelationFields = []

export type GameFields = Record<GamePermissionFields, boolean>
export type DeveloperFields = Record<DeveloperPermissionFields, boolean>
export type CharacterFields = Record<CharacterPermissionFields, boolean>
