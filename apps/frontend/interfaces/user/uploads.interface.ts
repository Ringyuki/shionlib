import { Language, Platform, GameCover, DeveloperRelation } from '../game/game.interface'

export interface GameResourcesItem {
  id: number
  platform: Platform[]
  language: Language[]
  note?: string
  downloads: number

  file_name: string
  more_than_one_file: boolean
  files_count: number

  created: string
  updated: string

  creator: {
    id: number
    name: string
    avatar: string
  }

  game: GameResourcesGame
}

export interface GameResourcesGame {
  id: number
  title_jp: string
  title_zh: string
  title_en: string
  intro_jp: string
  intro_zh: string
  intro_en: string
  covers: GameCover[]
}
