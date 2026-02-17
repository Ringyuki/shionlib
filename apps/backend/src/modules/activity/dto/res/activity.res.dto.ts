import { ActivityType, ActivityFileStatus, ActivityFileCheckStatus } from '../create-activity.dto'

export class ActivityResDto {
  id: number
  type: ActivityType
  user: {
    id: number
    name: string
    avatar: string
  }
  game?: {
    id: number
    title_jp: string
    title_zh: string
    title_en: string
  }
  comment?: {
    id: number
    html: string
  }
  developer?: {
    id: number
    name: string
  }
  character?: {
    id: number
    name_jp: string
    name_zh: string
    name_en: string
  }
  file?: {
    file_name: string
    file_size: number
    file_status: ActivityFileStatus
    file_check_status: ActivityFileCheckStatus
  }
  created: Date
  updated: Date
}
