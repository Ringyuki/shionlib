import { PrismaService } from '../../../prisma.service'
import { MessageQueryService } from './message-query.service'

describe('MessageQueryService', () => {
  it('returns unread count for a user', async () => {
    const prisma = {
      message: {
        count: jest.fn().mockResolvedValue(8),
      },
    } as unknown as PrismaService
    const service = new MessageQueryService(prisma)

    const count = await service.getUnreadCount(123)

    expect(prisma.message.count).toHaveBeenCalledWith({
      where: { receiver_id: 123, read: false },
    })
    expect(count).toBe(8)
  })
})
