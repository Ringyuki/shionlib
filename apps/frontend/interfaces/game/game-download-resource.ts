import { Platform } from './game.interface'
import { Language } from './game.interface'

export interface GameDownloadResource {
  id: number
  platform: Platform[]
  language: Language[]
  note?: string
  downloads: number
  creator: Creator
  files: GameDownloadResourceFile[]
  created: string
  updated: string
}

export interface GameDownloadResourceFile {
  id: number
  type: number
  file_status: number
  file_name: string
  file_size: number
  file_url?: string
  s3_file_key?: string
  hash_algorithm: 'sha256' | 'blake3'
  file_hash: string
  is_virus_false_positive?: boolean
  malware_scan_cases: {
    id: number
    detected_viruses: string[]
  }[]
  creator: Creator
}

export interface GameDownloadResourceFileHistory {
  id: number
  file_size: number
  hash_algorithm: string
  file_hash: string
  s3_file_key: string | null
  reason: string | null
  operator: Creator
  created: string
}

export interface Creator {
  id: number
  name: string
  avatar: string
}

export interface GameDownloadResourceFileLink {
  file_url: string
  expires_in: string
}
