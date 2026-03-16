import { Platform, DeveloperRelation, GameCover, GameTagRelation } from '../game/game.interface'

export interface FavoriteItem {
  id: number
  game: {
    id: number
    title_jp: string
    title_zh: string
    title_en: string
    platform: Platform[]
    type: string
    tags: GameTagRelation[]
    developers: DeveloperRelation[]
    covers: GameCover[]
    release_date: string
  }
}
