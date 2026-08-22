import { DeveloperRelation, GameCover } from '../game/game.interface'

export interface FavoriteItem {
  id: number
  note?: string
  game: {
    id: number
    title_jp: string
    title_zh: string
    title_en: string
    aliases: string[]
    intro_jp: string
    intro_zh: string
    intro_en: string
    type: string | null
    developers: DeveloperRelation[]
    covers: GameCover[]
    release_date: string | null
  }
}
