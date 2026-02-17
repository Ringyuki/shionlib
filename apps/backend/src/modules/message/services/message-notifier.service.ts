import { Injectable } from '@nestjs/common'
import { MessageGateway } from '../gateways/message.gateway'
import { MessageListItemResDto } from '../dto/res/message-list.res.dto'

@Injectable()
export class MessageNotifier {
  constructor(private readonly gateway: MessageGateway) {}

  notifyNewMessage(
    receiverId: number,
    message: Pick<MessageListItemResDto, 'id' | 'title' | 'type' | 'tone' | 'created'>,
  ) {
    const room = this.roomOf(receiverId)
    this.gateway.server.to(room).emit('message:new', message)
  }

  notifyUnreadCount(receiverId: number, unread: number) {
    const room = this.roomOf(receiverId)
    this.gateway.server.to(room).emit('message:unread', { unread })
  }

  private roomOf(userId: number) {
    return `user:${userId}`
  }
}
