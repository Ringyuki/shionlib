import { MessageTone, MessageType } from '../req/send-message.req.dto'

export class MessageListItemResDto {
  id: number
  type: MessageType
  tone: MessageTone
  title: string
  sender?: {
    id: number
    name: string
    avatar: string
  }
  receiver?: {
    id: number
    name: string
    avatar: string
  }

  read: boolean
  read_at?: Date
  created: Date
  updated: Date
}
