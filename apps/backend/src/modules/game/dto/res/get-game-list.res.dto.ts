import { GameCover } from '../../interfaces/game.interface'

export class GetGameListResDto {
  id: number
  title_jp: string
  title_zh: string
  title_en: string
  covers: GameCover[]
  views: number
}
