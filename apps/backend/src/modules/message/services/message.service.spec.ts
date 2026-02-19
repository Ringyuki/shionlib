import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { MessageService } from './message.service'

describe('MessageService', () => {
  const createService = () => {
    const prisma = {
      message: {
        create: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
    }

    const tx = {
      message: {
        create: jest.fn(),
        update: jest.fn(),
      },
    }

    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx))

    const messageNotifier = {
      notifyNewMessage: jest.fn(),
      notifyUnreadCount: jest.fn(),
    }

    return {
      prisma,
      tx,
      messageNotifier,
      service: new MessageService(prisma as any, messageNotifier as any),
    }
  }

  const req = { user: { sub: 7 } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('send skips self-like and self-reply notifications', async () => {
    const { service, prisma, messageNotifier } = createService()

    await service.send({
      type: 'COMMENT_LIKE',
      tone: 'PRIMARY',
      title: 't',
      content: 'c',
      receiver_id: 1,
      sender_id: 1,
    } as any)
    await service.send({
      type: 'COMMENT_REPLY',
      tone: 'PRIMARY',
      title: 't',
      content: 'c',
      receiver_id: 2,
      sender_id: 2,
    } as any)

    expect(prisma.message.create).not.toHaveBeenCalled()
    expect(messageNotifier.notifyNewMessage).not.toHaveBeenCalled()
  })

  it('send creates message and notifies receiver (with/without tx)', async () => {
    const { service, prisma, tx, messageNotifier } = createService()
    prisma.message.create.mockResolvedValueOnce({
      id: 100,
      title: 'hello',
      type: 'SYSTEM',
      tone: 'SUCCESS',
      created: new Date('2026-02-18T00:00:00.000Z'),
    })
    tx.message.create.mockResolvedValueOnce({
      id: 101,
      title: 'tx',
      type: 'SYSTEM',
      tone: 'WARNING',
      created: new Date('2026-02-18T00:00:00.000Z'),
    })

    await service.send({
      type: 'SYSTEM',
      tone: 'SUCCESS',
      title: 'hello',
      content: 'world',
      receiver_id: 9,
      meta: { a: 1 },
    } as any)
    await service.send(
      {
        type: 'SYSTEM',
        tone: 'WARNING',
        title: 'tx',
        content: 'with tx',
        receiver_id: 10,
      } as any,
      tx as any,
    )

    expect(prisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'SYSTEM',
          tone: 'SUCCESS',
          title: 'hello',
          meta: { a: 1 },
          receiver_id: 9,
        }),
      }),
    )
    expect(tx.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          receiver_id: 10,
        }),
      }),
    )
    expect(messageNotifier.notifyNewMessage).toHaveBeenNthCalledWith(
      1,
      9,
      expect.objectContaining({
        id: 100,
        title: 'hello',
      }),
    )
    expect(messageNotifier.notifyNewMessage).toHaveBeenNthCalledWith(
      2,
      10,
      expect.objectContaining({
        id: 101,
        title: 'tx',
      }),
    )
  })

  it('getList builds where clause and pagination meta', async () => {
    const { service, prisma } = createService()
    prisma.message.count.mockResolvedValue(3)
    prisma.message.findMany.mockResolvedValue([{ id: 1 }])

    const result = await service.getList(
      {
        page: 2,
        pageSize: 1,
        unread: true,
        type: 'SYSTEM',
      } as any,
      req as any,
    )

    expect(prisma.message.count).toHaveBeenCalledWith({
      where: {
        receiver_id: 7,
        read: false,
        type: 'SYSTEM',
      },
    })
    expect(prisma.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 1,
        take: 1,
        where: {
          receiver_id: 7,
          read: false,
          type: 'SYSTEM',
        },
      }),
    )
    expect(result.meta).toEqual({
      totalItems: 3,
      itemCount: 1,
      itemsPerPage: 1,
      totalPages: 3,
      currentPage: 2,
    })
  })

  it('getUnreadCount counts unread messages for current user', async () => {
    const { service, prisma } = createService()
    prisma.message.count.mockResolvedValue(6)
    await expect(service.getUnreadCount(req as any)).resolves.toBe(6)
    expect(prisma.message.count).toHaveBeenCalledWith({
      where: { receiver_id: 7, read: false },
    })
  })

  it('getById throws not found and forbidden', async () => {
    const { service, prisma } = createService()
    prisma.message.findUnique.mockResolvedValueOnce(null)
    await expect(service.getById(1, req as any)).rejects.toMatchObject({
      code: ShionBizCode.MESSAGE_NOT_FOUND,
    })

    prisma.message.findUnique.mockResolvedValueOnce({
      id: 1,
      receiver: { id: 999 },
    })
    await expect(service.getById(1, req as any)).rejects.toMatchObject({
      code: ShionBizCode.MESSAGE_FORBIDDEN,
    })
  })

  it('getById returns message and delegates markAsRead inside tx', async () => {
    const { service, prisma, tx } = createService()
    const msg = {
      id: 1,
      receiver: { id: 7 },
    }
    prisma.message.findUnique.mockResolvedValue(msg)
    const markAsReadSpy = jest.spyOn(service, 'markAsRead').mockResolvedValue(undefined)

    const result = await service.getById(1, req as any)

    expect(result).toBe(msg)
    expect(markAsReadSpy).toHaveBeenCalledWith(1, req, tx)
  })

  it('markAsRead updates read flag, recounts unread and notifies', async () => {
    const { service, prisma, tx, messageNotifier } = createService()
    prisma.message.count.mockResolvedValue(4)

    await service.markAsRead(1, req as any, tx as any)

    expect(tx.message.update).toHaveBeenCalledWith({
      where: { id: 1, receiver_id: 7 },
      data: { read: true, read_at: expect.any(Date) },
    })
    expect(messageNotifier.notifyUnreadCount).toHaveBeenCalledWith(7, 4)
  })

  it('markAllAsRead marks unread as read and notifies zero', async () => {
    const { service, prisma, messageNotifier } = createService()

    await service.markAllAsRead(req as any)

    expect(prisma.message.updateMany).toHaveBeenCalledWith({
      where: { receiver_id: 7, read: false },
      data: { read: true, read_at: expect.any(Date) },
    })
    expect(messageNotifier.notifyUnreadCount).toHaveBeenCalledWith(7, 0)
  })

  it('markAllAsUnread marks read as unread, recounts and notifies', async () => {
    const { service, prisma, messageNotifier } = createService()
    prisma.message.count.mockResolvedValue(9)

    await service.markAllAsUnread(req as any)

    expect(prisma.message.updateMany).toHaveBeenCalledWith({
      where: { receiver_id: 7, read: true },
      data: { read: false, read_at: null },
    })
    expect(messageNotifier.notifyUnreadCount).toHaveBeenCalledWith(7, 9)
  })
})
