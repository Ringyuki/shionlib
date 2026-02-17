import { ContentLimit } from '@/interfaces/user/user.interface'

export interface GameCover {
  id?: number
  language: Language
  url: string
  type: CoverType
  dims: number[]
  sexual: number
  violence: number
}

export interface GameImage {
  id?: number
  url: string
  dims: number[]
  sexual: number
  violence: number
}

export interface GameItem {
  id: number
  title_jp: string
  title_zh: string
  title_en: string
  aliases: string[]
  type: string
  covers?: GameCover[]
  views: number
}

export interface GameSearchItem extends GameItem {
  aliases: string[]
  intro_jp: string
  intro_zh: string
  intro_en: string
  developers: { developer: { id: number; name: string } }[]
  _formatted?: {
    title_jp?: string
    title_zh?: string
    title_en?: string
    aliases?: string[]
    intro_jp?: string
    intro_zh?: string
    intro_en?: string
  }
}

export interface ExtraInfo {
  key: string
  value: string
}
// ["win","lin","mac","ios","and","psp","ps2","drc","vnd","web","mob"]
export type Platform =
  | 'win'
  | 'ios'
  | 'and'
  | 'lin'
  | 'mac'
  | 'ps2'
  | 'ps3'
  | 'ps4'
  | 'psv'
  | 'psp'
  | 'swi'
  | 'dvd'
  | 'mob'
  | 'web'
  | 'vnd'
  | 'drc'
  | 'gba'
  | 'nds'
  | 'other'

export enum PlatformEnum {
  win = 'Windows',
  ios = 'iOS',
  and = 'Android',
  lin = 'Linux',
  mac = 'macOS',
  ps2 = 'PlayStation 2',
  ps3 = 'PlayStation 3',
  ps4 = 'PlayStation 4',
  psv = 'PlayStation Vita',
  psp = 'PlayStation Portable',
  swi = 'Nintendo Switch',
  dvd = 'DVD',
  mob = 'Mobile',
  web = 'Web',
  vnd = 'VNDS',
  drc = 'DRC',
  gba = 'Game Boy Advance',
  nds = 'Nintendo DS',
  other = 'Other',
}
export const PlatformOptions: Array<{ label: string; value: Platform }> = [
  { value: 'win', label: 'Windows' },
  { value: 'ios', label: 'iOS' },
  { value: 'and', label: 'Android' },
  { value: 'lin', label: 'Linux' },
  { value: 'mac', label: 'macOS' },
  { value: 'ps2', label: 'PlayStation 2' },
  { value: 'ps3', label: 'PlayStation 3' },
  { value: 'ps4', label: 'PlayStation 4' },
  { value: 'psv', label: 'PlayStation Vita' },
  { value: 'psp', label: 'PlayStation Portable' },
  { value: 'swi', label: 'Nintendo Switch' },
  { value: 'dvd', label: 'DVD' },
  { value: 'mob', label: 'Mobile' },
  { value: 'web', label: 'Web' },
  { value: 'vnd', label: 'VNDS' },
  { value: 'drc', label: 'DRC' },
  { value: 'gba', label: 'Game Boy Advance' },
  { value: 'nds', label: 'Nintendo DS' },
]

export const platformNameMap: Record<Platform, string> = {
  win: 'Windows',
  ios: 'iOS',
  and: 'Android',
  lin: 'Linux',
  mac: 'macOS',
  ps2: 'PlayStation 2',
  ps3: 'PlayStation 3',
  ps4: 'PlayStation 4',
  psv: 'PlayStation Vita',
  psp: 'PlayStation Portable',
  swi: 'Nintendo Switch',
  dvd: 'DVD',
  mob: 'Mobile',
  web: 'Web',
  vnd: 'VNDS',
  drc: 'DRC',
  gba: 'Game Boy Advance',
  nds: 'Nintendo DS',
  other: 'Other',
}

export const platformTokenMap: Record<Platform, { bg: string; fg: string }> = {
  win: { bg: 'var(--platform-win)', fg: 'var(--platform-win-fg)' },
  ios: { bg: 'var(--platform-ios)', fg: 'var(--platform-ios-fg)' },
  and: { bg: 'var(--platform-and)', fg: 'var(--platform-and-fg)' },
  lin: { bg: 'var(--platform-lin)', fg: 'var(--platform-lin-fg)' },
  mac: { bg: 'var(--platform-mac)', fg: 'var(--platform-mac-fg)' },
  ps2: { bg: 'var(--platform-ps2)', fg: 'var(--platform-ps2-fg)' },
  ps3: { bg: 'var(--platform-ps3)', fg: 'var(--platform-ps3-fg)' },
  ps4: { bg: 'var(--platform-ps4)', fg: 'var(--platform-ps4-fg)' },
  psv: { bg: 'var(--platform-psv)', fg: 'var(--platform-psv-fg)' },
  psp: { bg: 'var(--platform-psp)', fg: 'var(--platform-psp-fg)' },
  swi: { bg: 'var(--platform-swi)', fg: 'var(--platform-swi-fg)' },
  dvd: { bg: 'var(--platform-dvd)', fg: 'var(--platform-dvd-fg)' },
  mob: { bg: 'var(--platform-mob)', fg: 'var(--platform-mob-fg)' },
  web: { bg: 'var(--platform-web)', fg: 'var(--platform-web-fg)' },
  vnd: { bg: 'var(--platform-vnd)', fg: 'var(--platform-vnd-fg)' },
  drc: { bg: 'var(--platform-drc)', fg: 'var(--platform-drc-fg)' },
  gba: { bg: 'var(--platform-gba)', fg: 'var(--platform-gba-fg)' },
  nds: { bg: 'var(--platform-nds)', fg: 'var(--platform-nds-fg)' },
  other: { bg: 'var(--platform-other)', fg: 'var(--platform-other-fg)' },
}

export type Language = 'jp' | 'zh' | 'en' | 'zh-hant' | 'other'
export const LanguageOptions: Array<{ label: string; value: Partial<Language> }> = [
  { value: 'jp', label: '日本語' },
  { value: 'zh', label: '简体中文' },
  { value: 'zh-hant', label: '繁體中文' },
  { value: 'en', label: 'English' },
]
export const LanguageNameMap: Record<Language, string> = {
  jp: '日本語',
  zh: '简体中文',
  en: 'English',
  'zh-hant': '繁體中文',
  other: '其它',
}

export type CoverType = 'dig' | 'pkgfront'
export enum CoverTypeEnum {
  dig = 'Digital',
  pkgfront = 'Package Front',
}
export const CoverTypeOptions: Array<{ label: string; value: CoverType }> = [
  { value: 'dig', label: 'Digital' },
  { value: 'pkgfront', label: 'Package Front' },
]
export const CoverTypeNameMap: Record<CoverType, string> = {
  dig: 'Digital',
  pkgfront: 'Package Front',
}

export interface GameData {
  creator_id: number

  b_id?: string
  v_id?: string

  id: number
  title_jp: string
  title_zh: string
  title_en: string
  aliases: string[]
  intro_jp: string
  intro_zh: string
  intro_en: string
  covers?: GameCover[]
  images: GameImage[]
  release_date: Date
  release_date_tba: boolean
  extra_info: ExtraInfo[]
  link: GameLink[]

  tags: string[]
  staffs: GameStaff[]
  developers: DeveloperRelation[]
  characters: GameCharacterRelation[]

  nsfw: boolean
  type: string
  platform: Platform[]

  content_limit: ContentLimit
}

export interface GameHeader
  extends Pick<
    GameData,
    | 'v_id'
    | 'id'
    | 'title_jp'
    | 'title_zh'
    | 'title_en'
    | 'aliases'
    | 'type'
    | 'platform'
    | 'covers'
    | 'developers'
    | 'release_date'
    | 'release_date_tba'
    | 'content_limit'
  > {}

export interface GameDetail
  extends Pick<
    GameData,
    | 'id'
    | 'intro_jp'
    | 'intro_zh'
    | 'intro_en'
    | 'images'
    | 'tags'
    | 'staffs'
    | 'extra_info'
    | 'link'
    | 'nsfw'
    | 'content_limit'
  > {}

export interface GameStaff {
  name: string
  role: string
}

export interface Developer {
  id: number
  name: string
  aliases?: string[]
  logo?: string
}

export interface DeveloperRelation {
  id: number
  role: string | null
  developer_id: number
  developer: Developer
}
export interface GameCharacter {
  b_id?: string
  v_id?: string
  id: number
  image?: string

  name_jp?: string
  name_zh?: string
  name_en?: string
  aliases?: string[]
  intro_jp?: string
  intro_zh?: string
  intro_en?: string
  gender?: GameCharacterGender[]
  blood_type?: GameCharacterBloodType
  height?: number
  weight?: number
  bust?: number
  waist?: number
  hips?: number
  cup?: string
  age?: number
  birthday: number[] // [month, day]
}

export type GameCharacterBloodType = 'a' | 'b' | 'ab' | 'o'
export type GameCharacterGender = 'm' | 'f' | 'o' | 'a'
export const GameCharacterGenderMap: { [key in GameCharacterGender]: string } = {
  m: 'male',
  f: 'female',
  o: 'non_binary',
  a: 'ambiguous',
}
export type GameCharacterRole = 'main' | 'primary' | 'side' | 'appears'

export interface GameCharacterRelation {
  id: number
  character_id: number
  image?: string
  actor?: string
  role?: GameCharacterRole
  character: GameCharacter
}

export interface GameCoverRelation {
  game_id: number
  cover_id: number
}

export interface GameLink {
  id: number
  url: string
  label: string
  name: string
}
