import { Platform, Language } from '../game/game.interface'

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
