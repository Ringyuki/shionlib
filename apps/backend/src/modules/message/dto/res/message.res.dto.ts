import { MessageType, MessageMeta, MessageTone } from '../req/send-message.req.dto'

export class MessageResDto {
  id: number
  type: MessageType
  tone: MessageTone
  title: string
  content: string
  link_text: string | null
  link_url: string | null
  external_link: boolean
  meta: MessageMeta | null
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

  read: boolean
  read_at: Date | null
  created: Date
  updated: Date
}
