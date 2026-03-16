import { GameResourcesDeveloperRelation } from './game-resources.res.dto'
import { GameResourcesGameCover } from './game-resources.res.dto'
import { GamePlatform } from '../../../game/interfaces/game.interface'
import { GameTag } from '../../../game/dto/res/get-game.res.dto'

export class FavoritesResDto {
  id: number
  game: {
    id: number
    title_jp: string
    title_zh: string
    title_en: string
    platform: GamePlatform[]
    type: string
    tags: GameTag[]
    developers: GameResourcesDeveloperRelation[]
    covers: GameResourcesGameCover[]
    release_date: string
  }
}
