import { GamePlatform } from '../../../game/interfaces/game.interface'

export class PartnerDownloadSummaryResDto {
  v_id: string
  resource_count: number
  file_count: number
  total_size: string
}

export class PartnerDownloadFileResDto {
  id: number
  file_name: string
  file_size: string
  file_hash: string | null
  hash_algorithm: string | null
}

export class PartnerDownloadResourceResDto {
  id: number
  game_id: number
  platform: GamePlatform[]
  language: ('zh' | 'zh-hant' | 'en' | 'jp')[]
  simulator: string | null
  note: string | null
  downloads: number
  files: PartnerDownloadFileResDto[]
  created: string
  updated: string
}

export class PartnerDownloadLinkResDto {
  file_url: string
  expires_in: number
}
