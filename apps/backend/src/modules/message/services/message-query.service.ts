import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'

@Injectable()
export class MessageQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async getUnreadCount(userId: number) {
    return this.prisma.message.count({ where: { receiver_id: userId, read: false } })
  }
}
