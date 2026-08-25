import { Platform, Language, GameCover } from '../game/game.interface'

export interface ReleaseItem {
  id: number
  platform: Platform[]
  language: Language[]
  note?: string
  downloads: number
  game: {
    id: number
    title_jp: string
    title_zh: string
    title_en: string
    intro_jp: string
    intro_zh: string
    intro_en: string
    covers: GameCover[]
  }
  files: string[]
  files_count: number
  creator: {
    id: number
    name: string
    avatar: string
  }
  created: string
}
