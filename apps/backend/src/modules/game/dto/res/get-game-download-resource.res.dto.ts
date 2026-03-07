import { GamePlatform } from '../../interfaces/game.interface'

export class GetGameDownloadResourceResDto {
  id: number
  platform: GamePlatform[]
  language: ('zh' | 'en' | 'jp')[]
  simulator?: string
  note?: string
  downloads: number
  creator: Creator
  files: GameDownloadResourceFile[]
  created: string
  updated: string
}

export class GameDownloadResourceFile {
  id: number
  type: number
  file_name: string
  file_size: number
  file_url: string
  s3_file_key: string
  file_hash: string
  is_virus_false_positive: boolean
  malware_scan_cases: MalwareScanCase[]
  creator: Creator
  latest_history?: {
    id: number
    reason: string | null
    created: string
    operator_id: number
  } | null
}

class Creator {
  id: number
  name: string
  avatar: string
}

class MalwareScanCase {
  id: number
  detected_viruses: string[]
}
