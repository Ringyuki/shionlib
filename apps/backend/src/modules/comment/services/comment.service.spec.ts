import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'
import { MessageTone, MessageType } from '../../message/dto/req/send-message.req.dto'
import { OMNI_MODERATION_JOB } from '../../moderate/constants/moderation.constants'
import { CommentServices } from './comment.service'

describe('CommentServices', () => {
  const createService = () => {
    const prismaService = {
      $transaction: jest.fn(),
      comment: {
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
    }

    const renderService = {
      toHtml: jest.fn(),
    }

    const messageService = {
      send: jest.fn(),
    }

    const moderationQueue = {
      add: jest.fn(),
    }

    return {
      prismaService,
      renderService,
      messageService,
      moderationQueue,
      service: new CommentServices(
        prismaService as any,
        renderService as any,
        messageService as any,
        moderationQueue as any,
      ),
    }
  }

  it('createGameComment throws when parent comment is invalid', async () => {
    const { service, prismaService, renderService } = createService()
    renderService.toHtml.mockResolvedValue('<p>x</p>')

    const tx = {
      comment: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
      },
    }
    prismaService.$transaction.mockImplementation(async (cb: any) => cb(tx))

    await expect(
      service.createGameComment(
        100,
        { content: { root: {} }, parent_id: 7 } as any,
        { user: { sub: 1 } } as any,
      ),
    ).rejects.toMatchObject({
      code: ShionBizCode.COMMENT_NOT_FOUND,
    })
  })

  it('createGameComment creates root comment and enqueues moderation', async () => {
    const { service, prismaService, renderService, moderationQueue } = createService()
    renderService.toHtml.mockResolvedValue('<p>hello</p>')

    const tx = {
      comment: {
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({
          id: 10,
          content: { root: {} },
          html: '<p>hello</p>',
          parent_id: null,
          parent: null,
          root_id: null,
          creator: { id: 1, name: 'alice', avatar: null },
          status: 2,
          created: new Date('2026-02-18T00:00:00.000Z'),
          updated: new Date('2026-02-18T00:00:00.000Z'),
        }),
        update: jest.fn(),
      },
    }
    prismaService.$transaction.mockImplementation(async (cb: any) => cb(tx))

    const result = await service.createGameComment(
      100,
      { content: { root: {} } } as any,
      { user: { sub: 1 } } as any,
    )

    expect(tx.comment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          game_id: 100,
          creator_id: 1,
          status: 2,
        }),
      }),
    )
    expect(tx.comment.update).toHaveBeenCalledWith({ where: { id: 10 }, data: { root_id: 10 } })
    expect(moderationQueue.add).toHaveBeenCalledWith(OMNI_MODERATION_JOB, { commentId: 10 })
    expect(result).toMatchObject({ id: 10, root_id: 10, like_count: 0 })
  })

  it('editComment validates id, existence and ownership', async () => {
    const { service, prismaService } = createService()

    await expect(
      service.editComment(0, { content: {} } as any, { user: { sub: 1, role: 1 } } as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.COMMENT_NOT_FOUND,
    })

    prismaService.comment.findUnique.mockResolvedValueOnce(null)
    await expect(
      service.editComment(1, { content: {} } as any, { user: { sub: 1, role: 1 } } as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.COMMENT_NOT_FOUND,
    })

    prismaService.comment.findUnique.mockResolvedValueOnce({ id: 1, creator_id: 2 })
    await expect(
      service.editComment(1, { content: {} } as any, { user: { sub: 1, role: 1 } } as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.COMMENT_NOT_OWNER,
    })
  })

  it('editComment updates comment and enqueues moderation', async () => {
    const { service, prismaService, renderService, moderationQueue } = createService()
    prismaService.comment.findUnique.mockResolvedValue({ id: 1, creator_id: 1 })
    renderService.toHtml.mockResolvedValue('<p>edited</p>')
    prismaService.comment.update.mockResolvedValue({ id: 1, html: '<p>edited</p>' })

    const result = await service.editComment(
      1,
      { content: { root: {} } } as any,
      { user: { sub: 1, role: ShionlibUserRoles.USER } } as any,
    )

    expect(prismaService.comment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: { content: { root: {} }, html: '<p>edited</p>', edited: true, status: 2 },
      }),
    )
    expect(moderationQueue.add).toHaveBeenCalledWith(OMNI_MODERATION_JOB, { commentId: 1 })
    expect(result).toEqual({ id: 1, html: '<p>edited</p>' })
  })

  it('getRaw validates existence and ownership', async () => {
    const { service, prismaService } = createService()
    prismaService.comment.findUnique.mockResolvedValueOnce(null)

    await expect(service.getRaw(1, { user: { sub: 1, role: 1 } } as any)).rejects.toMatchObject({
      code: ShionBizCode.COMMENT_NOT_FOUND,
    })

    prismaService.comment.findUnique.mockResolvedValueOnce({ id: 1, content: {}, creator_id: 2 })
    await expect(service.getRaw(1, { user: { sub: 1, role: 1 } } as any)).rejects.toMatchObject({
      code: ShionBizCode.COMMENT_NOT_OWNER,
    })

    prismaService.comment.findUnique.mockResolvedValueOnce({ id: 1, content: {}, creator_id: 2 })
    await expect(
      service.getRaw(1, { user: { sub: 1, role: ShionlibUserRoles.ADMIN } } as any),
    ).resolves.toEqual({ id: 1, content: {}, creator_id: 2 })
  })

  it('deleteComment validates id/existence/ownership', async () => {
    const { service, prismaService } = createService()

    await expect(
      service.deleteComment(0, { user: { sub: 1, role: 1 } } as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.COMMENT_NOT_FOUND,
    })

    prismaService.comment.findUnique.mockResolvedValueOnce(null)
    await expect(
      service.deleteComment(1, { user: { sub: 1, role: 1 } } as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.COMMENT_NOT_FOUND,
    })

    prismaService.comment.findUnique.mockResolvedValueOnce({ id: 1, creator_id: 2 })
    await expect(
      service.deleteComment(1, { user: { sub: 1, role: 1 } } as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.COMMENT_NOT_OWNER,
    })
  })

  it('deleteComment removes comment and decrements counters in transaction', async () => {
    const { service, prismaService } = createService()
    prismaService.comment.findUnique.mockResolvedValue({
      id: 5,
      creator_id: 1,
      parent_id: 3,
      root_id: 2,
    })

    const tx = {
      comment: {
        delete: jest.fn(),
        update: jest.fn(),
      },
    }
    prismaService.$transaction.mockImplementation(async (cb: any) => cb(tx))

    await service.deleteComment(5, { user: { sub: 1, role: 1 } } as any)

    expect(tx.comment.delete).toHaveBeenCalledWith({ where: { id: 5 } })
    expect(tx.comment.update).toHaveBeenNthCalledWith(1, {
      where: { id: 3 },
      data: { reply_count: { decrement: 1 } },
    })
    expect(tx.comment.update).toHaveBeenNthCalledWith(2, {
      where: { id: 2 },
      data: { reply_count: { decrement: 1 } },
    })
  })

  it('getGameComments returns mapped paginated result', async () => {
    const { service, prismaService } = createService()
    prismaService.comment.count.mockResolvedValue(4)
    prismaService.comment.findMany.mockResolvedValue([
      {
        id: 1,
        html: '<p>x</p>',
        parent_id: 10,
        parent: {
          id: 10,
          html: '<p>parent</p>',
          creator: { id: 2, name: 'p', avatar: null },
        },
        root_id: 10,
        reply_count: 3,
        liked_users: [{ id: 1 }],
        _count: { liked_users: 6 },
        creator: { id: 1, name: 'alice', avatar: null },
        edited: false,
        status: 1,
        created: new Date('2026-02-18T00:00:00.000Z'),
        updated: new Date('2026-02-18T00:00:00.000Z'),
      },
    ])

    const result = await service.getGameComments(
      7,
      { page: 2, pageSize: 1 } as any,
      { user: { sub: 1 } } as any,
    )

    expect(prismaService.comment.count).toHaveBeenCalledWith({
      where: {
        OR: [
          { game_id: 7, status: 1 },
          { game_id: 7, creator_id: 1, status: { not: 3 } },
        ],
      },
    })
    expect(result).toEqual({
      items: [
        {
          id: 1,
          html: '<p>x</p>',
          parent_id: 10,
          root_id: 10,
          reply_count: 3,
          parent: {
            id: 10,
            html: '<p>parent</p>',
            creator: { id: 2, name: 'p', avatar: null },
          },
          is_liked: true,
          like_count: 6,
          creator: { id: 1, name: 'alice', avatar: null },
          edited: false,
          status: 1,
          created: new Date('2026-02-18T00:00:00.000Z'),
          updated: new Date('2026-02-18T00:00:00.000Z'),
        },
      ],
      meta: {
        totalItems: 4,
        itemCount: 1,
        itemsPerPage: 1,
        totalPages: 4,
        currentPage: 2,
      },
    })
  })

  it('likeComment throws when target does not exist', async () => {
    const { service, prismaService } = createService()
    prismaService.comment.findUnique.mockResolvedValue(null)

    await expect(service.likeComment(1, { user: { sub: 9 } } as any)).rejects.toMatchObject({
      code: ShionBizCode.COMMENT_NOT_FOUND,
    })
  })

  it('likeComment disconnects existing like', async () => {
    const { service, prismaService, messageService } = createService()
    prismaService.comment.findUnique.mockResolvedValue({
      id: 1,
      liked_users: [{ id: 9 }],
      creator_id: 2,
      game_id: 3,
    })

    const tx = {
      comment: {
        update: jest.fn(),
      },
    }
    prismaService.$transaction.mockImplementation(async (cb: any) => cb(tx))

    await service.likeComment(1, { user: { sub: 9 } } as any)

    expect(tx.comment.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { liked_users: { disconnect: { id: 9 } } },
    })
    expect(messageService.send).not.toHaveBeenCalled()
  })

  it('likeComment connects like and sends notification', async () => {
    const { service, prismaService, messageService } = createService()
    prismaService.comment.findUnique.mockResolvedValue({
      id: 1,
      liked_users: [],
      creator_id: 2,
      game_id: 3,
    })

    const tx = {
      comment: {
        update: jest.fn(),
      },
    }
    prismaService.$transaction.mockImplementation(async (cb: any) => cb(tx))

    await service.likeComment(1, { user: { sub: 9 } } as any)

    expect(tx.comment.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { liked_users: { connect: { id: 9 } } },
    })
    expect(messageService.send).toHaveBeenCalledWith(
      {
        type: MessageType.COMMENT_LIKE,
        tone: MessageTone.INFO,
        title: 'Messages.Comment.Like.Title',
        content: 'Messages.Comment.Like.Content',
        receiver_id: 2,
        comment_id: 1,
        game_id: 3,
        sender_id: 9,
      },
      tx,
    )
  })
})
