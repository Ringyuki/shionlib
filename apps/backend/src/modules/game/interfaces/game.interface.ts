export interface GameData {
  creator_id: number
  id: number

  b_id?: string
  v_id?: string

  title_jp: string
  title_zh: string
  title_en: string
  aliases: string[]
  intro_jp: string
  intro_zh: string
  intro_en: string
  covers: GameCover[]
  images: GameImage[]
  release_date: Date
  extra_info: Record<string, string>[]
  links: GameLink[]

  developers: {
    role: string
    developer: GameDeveloper
  }[]
  characters: {
    role: string
    actor: string
    character: GameCharacter
  }[]

  tags: string[]
  staffs: GameStaff[]

  nsfw: boolean
  type?: string
  platform?: GamePlatform[]
}

export type GamePlatform =
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

export interface GameCover {
  language: string
  url: string
  type: string
  dims: number[]
  sexual: number
  violence: number
}

export interface GameCoverRelation {
  game_id: number
  cover_id: number
}

export interface GameImage {
  url: string
  dims: number[]
  sexual: number
  violence: number
}

export interface GameLink {
  url: string
  label: string
  name: string
}

interface GameStaff {
  name: string
  role: string
}

export interface GameDeveloper {
  id?: number
  b_id?: string
  v_id?: string
  name: string
  aliases?: string[]
  logo?: string
  intro_jp?: string
  intro_zh?: string
  intro_en?: string
  website?: string
  extra_info?: Record<string, string>[]
}

export interface GameDeveloperRelation {
  role: string
  game_id: number
  developer_id: number
}

export type GameCharacterBloodType = 'a' | 'b' | 'ab' | 'o'
export type GameCharacterGender = 'm' | 'f' | 'o' | 'a'
export type GameCharacterRole = 'main' | 'primary' | 'side' | 'appears'

export interface GameCharacter {
  b_id?: string
  v_id?: string
  image?: string
  actor?: string
  role?: GameCharacterRole

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
  birthday?: number[] // [month, day]
}

export interface GameCharacterRelation {
  image?: string
  actor?: string
  role?: GameCharacterRole

  game_id: number
  character_id: number
}
