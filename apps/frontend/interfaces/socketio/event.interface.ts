import { Message } from '@/interfaces/message/message.interface'

export interface SocketEvent {
  event: Event
  data: MessageNewEvent | MessageUnreadEvent
}

export type Event = 'connect' | 'message:new' | 'message:unread'

export type MessageNewEvent = Pick<Message, 'id' | 'type' | 'tone' | 'title' | 'created'>
export interface MessageUnreadEvent {
  unread: number
}
