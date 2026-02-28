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
    intro_jp: string
    intro_zh: string
    intro_en: string
    covers: {
      language: string
      url: string
      type: string
      dims: number[]
      sexual: number
      violence: number
    }[]
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
