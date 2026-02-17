import { GamePlatform } from '../../interfaces/game.interface'

export class GetDownloadResourcesListResDto {
  id: number
  platform: GamePlatform[]
  language: ('zh' | 'en' | 'jp')[]
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
