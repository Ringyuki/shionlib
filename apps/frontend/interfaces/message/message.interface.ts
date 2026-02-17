export enum MessageType {
  COMMENT_REPLY = 'COMMENT_REPLY',
  COMMENT_LIKE = 'COMMENT_LIKE',
  SYSTEM = 'SYSTEM',
}

export enum MessageTone {
  PRIMARY = 'PRIMARY',
  SECONDARY = 'SECONDARY',
  SUCCESS = 'SUCCESS',
  WARNING = 'WARNING',
  INFO = 'INFO',
  DESTRUCTIVE = 'DESTRUCTIVE',
  NEUTRAL = 'NEUTRAL',
}

export interface MessageMeta {
  file_id?: number
  file_name?: string
  file_size?: number
  [key: string]: unknown
}

export interface Message {
  id: number
  type: MessageType
  tone: MessageTone
  title: string
  content: string
  link_text: string | null
  link_url: string | null
  external_link: boolean
  comment?: {
    id: number
    html: string
  } | null
  game?: {
    id: number
    title_zh: string
    title_en: string
    title_jp: string
  } | null
  sender?: {
    id: number
    name: string
    avatar: string
  } | null
  receiver: {
    id: number
    name: string
    avatar: string
  }

  meta: MessageMeta | null

  read: boolean
  read_at: Date | null
  created: Date
  updated: Date
}
