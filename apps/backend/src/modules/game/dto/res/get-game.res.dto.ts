import {
  GameCharacterGender,
  GameCharacterBloodType,
  GameCharacterRole,
} from '../../interfaces/game.interface'

export class GetGameResDto {
  id: number
  title_jp: string
  title_zh: string
  title_en: string
  aliases: string[]
  intro_jp: string
  intro_zh: string
  intro_en: string
  covers: GameCover[]
  images: GameImage[]
  release_date: string
  release_date_tba: boolean
  extra_info: ExtraInfo[]
  tags: string[]
  staffs: GameStaff[]
  nsfw: boolean
  type?: string
  platform: string[]
  developers: GameDeveloper[]
  characters: GameCharacter[]
  creator: Creator
  content_limit: number
}

export class GameCover {
  language: string
  url: string
  type: string
  dims: number[]
  sexual: number
  violence: number
}

export class GameImage {
  url: string
  dims: number[]
  sexual: number
  violence: number
}

export class GameStaff {
  name: string
  role: string
}

export class GameDeveloper {
  developer: Developer
  role: string
}

class Developer {
  id: number
  name: string
  aliases: string[]
}

export class GameCharacter {
  role: GameCharacterRole
  image?: string
  actor?: string
  character: Character
}

class Character {
  id: number
  image?: string
  name_jp?: string
  name_zh?: string
  name_en?: string
  aliases: string[]
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

export class Creator {
  id: number
  name: string
  avatar: string
}

class ExtraInfo {
  key: string
  value: string
}
