import { GamePlatform } from '../../../game/interfaces/game.interface'

export class GameResourcesResDto {
  id: number
  platform: GamePlatform[]
  language: ('zh' | 'en' | 'jp')[]
  note?: string
  downloads: number

  file_name: string
  more_than_one_file: boolean
  files_count: number

  created: string
  updated: string

  game: GameResourcesGame
}

export class GameResourcesGameCover {
  url: string
  dims: number[]
  sexual: number
  violence: number
}

export class GameResourcesDeveloperInfo {
  id: number
  name: string
  aliases: string[]
}

export class GameResourcesDeveloperRelation {
  role: string | null
  developer: GameResourcesDeveloperInfo
}

export class GameResourcesGame {
  id: number
  title_jp: string
  title_zh: string
  title_en: string
  developers: GameResourcesDeveloperRelation[]
  covers: GameResourcesGameCover[]
}
