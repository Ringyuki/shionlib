import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { ActivityType } from '../../activity/dto/create-activity.dto'
import { MessageTone, MessageType } from '../../message/dto/req/send-message.req.dto'
import { OMNI_MODERATION_JOB } from '../../moderate/constants/moderation.constants'
import { AdminCommentService } from './admin-comment.service'

describe('AdminCommentService', () => {
  const createService = () => {
    const prisma = {
      comment: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    }

    const activityService = {
      create: jest.fn(),
    }

    const messageService = {
      send: jest.fn(),
    }

    const moderationQueue = {
      add: jest.fn(),
    }

    return {
      prisma,
      activityService,
      messageService,
      moderationQueue,
      service: new AdminCommentService(
        prisma as any,
        activityService as any,
        messageService as any,
        moderationQueue as any,
      ),
    }
  }

  it('getCommentList builds query and maps moderation summary', async () => {
    const { service, prisma } = createService()
    const now = new Date('2026-02-18T00:00:00.000Z')

    prisma.comment.findMany.mockResolvedValue([
      {
        id: 1,
        html: '<p>x</p>',
        parent_id: 2,
        parent: {
          id: 2,
          html: '<p>p</p>',
          creator: { id: 3, name: 'parent', avatar: null },
        },
        root_id: 2,
        reply_count: 4,
        edited: false,
        status: 2,
        created: now,
        updated: now,
        _count: { liked_users: 9 },
        creator: { id: 10, name: 'alice', avatar: null, email: 'a@example.com' },
        game: { id: 7, title_jp: 'jp', title_zh: 'zh', title_en: 'en' },
        moderates: [
          {
            id: 100,
            decision: 'BLOCK',
            model: 'm1',
            top_category: 'HARASSMENT',
            max_score: 0.77,
            reason: 'bad',
            evidence: 'e',
            created_at: now,
          },
        ],
      },
    ])
    prisma.comment.count.mockResolvedValue(5)

    const result = await service.getCommentList({
      page: 1,
      pageSize: 10,
      search: '123',
      status: 2,
      creatorId: 10,
      gameId: 7,
      sortBy: 'created',
      sortOrder: 'desc',
    } as any)

    expect(prisma.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 2,
          creator_id: 10,
          game_id: 7,
          OR: expect.arrayContaining([
            { id: 123 },
            { creator_id: 123 },
            { game_id: 123 },
            { html: { contains: '123', mode: 'insensitive' } },
          ]),
        }),
        orderBy: { created: 'desc' },
        skip: 0,
        take: 10,
      }),
    )

    expect(result).toEqual({
      items: [
        {
          id: 1,
          html: '<p>x</p>',
          parent_id: 2,
          root_id: 2,
          reply_count: 4,
          like_count: 9,
          creator: { id: 10, name: 'alice', avatar: null, email: 'a@example.com' },
          parent: {
            id: 2,
            html: '<p>p</p>',
            creator: { id: 3, name: 'parent', avatar: null },
          },
          game: { id: 7, title_jp: 'jp', title_zh: 'zh', title_en: 'en' },
          edited: false,
          status: 2,
          created: now,
          updated: now,
          moderation: {
            id: 100,
            decision: 'BLOCK',
            model: 'm1',
            top_category: 'HARASSMENT',
            max_score: 0.77,
            reason: 'bad',
            evidence: 'e',
            created_at: now,
          },
        },
      ],
      meta: {
        totalItems: 5,
        itemCount: 1,
        itemsPerPage: 10,
        totalPages: 1,
        currentPage: 1,
      },
    })
  })

  it('getCommentDetail throws when comment does not exist', async () => {
    const { service, prisma } = createService()
    prisma.comment.findUnique.mockResolvedValue(null)

    await expect(service.getCommentDetail(99)).rejects.toMatchObject({
      code: ShionBizCode.COMMENT_NOT_FOUND,
    })
  })

  it('getCommentDetail maps moderation history', async () => {
    const { service, prisma } = createService()
    const now = new Date('2026-02-18T00:00:00.000Z')

    prisma.comment.findUnique.mockResolvedValue({
      id: 1,
      html: '<p>x</p>',
      content: { root: {} },
      parent_id: null,
      parent: null,
      root_id: 1,
      reply_count: 0,
      edited: false,
      status: 1,
      created: now,
      updated: now,
      _count: { liked_users: 3 },
      creator: { id: 1, name: 'alice', avatar: null, email: 'a@example.com' },
      game: { id: 7, title_jp: 'jp', title_zh: 'zh', title_en: 'en' },
      moderates: [
        {
          id: 5,
          audit_by: 9,
          model: 'm1',
          decision: 'ALLOW',
          top_category: 'SAFE',
          categories_json: {},
          scores_json: {},
          max_score: null,
          reason: null,
          evidence: null,
          created_at: now,
        },
      ],
    })

    const result = await service.getCommentDetail(1)

    expect(result).toMatchObject({
      id: 1,
      like_count: 3,
      moderations: [
        {
          id: 5,
          max_score: null,
        },
      ],
    })
  })

  it('updateCommentStatus throws when comment does not exist', async () => {
    const { service, prisma } = createService()
    prisma.comment.findUnique.mockResolvedValue(null)

    await expect(
      service.updateCommentStatus(1, { status: 1 } as any, { sub: 9 } as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.COMMENT_NOT_FOUND,
    })
  })

  it('updateCommentStatus returns early when status does not change', async () => {
    const { service, prisma } = createService()
    prisma.comment.findUnique.mockResolvedValue({
      id: 1,
      status: 2,
      creator_id: 1,
      game_id: 7,
      parent_id: null,
      parent: null,
    })

    await service.updateCommentStatus(1, { status: 2 } as any, { sub: 9 } as any)

    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('updateCommentStatus to approved creates activity and reply message when needed', async () => {
    const { service, prisma, activityService, messageService } = createService()
    prisma.comment.findUnique.mockResolvedValue({
      id: 1,
      status: 2,
      creator_id: 10,
      game_id: 7,
      parent_id: 2,
      parent: { creator_id: 11 },
    })

    const tx = {
      comment: {
        update: jest.fn(),
      },
      activity: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      message: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    }
    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx))

    await service.updateCommentStatus(1, { status: 1 } as any, { sub: 99 } as any)

    expect(tx.comment.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { status: 1 } })
    expect(activityService.create).toHaveBeenCalledWith(
      {
        type: ActivityType.COMMENT,
        user_id: 10,
        game_id: 7,
        comment_id: 1,
      },
      tx,
    )
    expect(messageService.send).toHaveBeenCalledWith(
      {
        type: MessageType.COMMENT_REPLY,
        tone: MessageTone.INFO,
        title: 'Messages.Comment.Reply.Title',
        content: 'Messages.Comment.Reply.Content',
        receiver_id: 11,
        comment_id: 1,
        game_id: 7,
        sender_id: 10,
      },
      tx,
    )
  })

  it('updateCommentStatus to blocked sends system notification by default', async () => {
    const { service, prisma, messageService } = createService()
    prisma.comment.findUnique.mockResolvedValue({
      id: 1,
      status: 1,
      creator_id: 10,
      game_id: 7,
      parent_id: null,
      parent: null,
    })

    const tx = {
      comment: {
        update: jest.fn(),
      },
      activity: {
        findFirst: jest.fn(),
      },
      message: {
        findFirst: jest.fn(),
      },
    }
    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx))

    await service.updateCommentStatus(
      1,
      { status: 3, reason: 'manual review', evidence: 'policy' } as any,
      { sub: 99 } as any,
    )

    expect(messageService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageType.SYSTEM,
        tone: MessageTone.DESTRUCTIVE,
        title: 'Messages.System.Moderation.Comment.Block.Title',
        content: 'Messages.System.Moderation.Comment.Block.ReviewContent',
        receiver_id: 10,
        comment_id: 1,
        game_id: 7,
        sender_id: 99,
        meta: expect.objectContaining({
          reason: 'manual review',
          evidence: 'policy',
        }),
      }),
      tx,
    )
  })

  it('updateCommentStatus to blocked skips notification when notify=false', async () => {
    const { service, prisma, messageService } = createService()
    prisma.comment.findUnique.mockResolvedValue({
      id: 1,
      status: 1,
      creator_id: 10,
      game_id: 7,
      parent_id: null,
      parent: null,
    })

    const tx = {
      comment: {
        update: jest.fn(),
      },
      activity: {
        findFirst: jest.fn(),
      },
      message: {
        findFirst: jest.fn(),
      },
    }
    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx))

    await service.updateCommentStatus(1, { status: 3, notify: false } as any, { sub: 99 } as any)

    expect(messageService.send).not.toHaveBeenCalled()
  })

  it('rescanComment validates existence and enqueues moderation job', async () => {
    const { service, prisma, moderationQueue } = createService()
    prisma.comment.findUnique.mockResolvedValueOnce(null)

    await expect(service.rescanComment(1)).rejects.toMatchObject({
      code: ShionBizCode.COMMENT_NOT_FOUND,
    })

    prisma.comment.findUnique.mockResolvedValueOnce({ id: 1 })
    await service.rescanComment(1)

    expect(prisma.comment.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { status: 2 } })
    expect(moderationQueue.add).toHaveBeenCalledWith(OMNI_MODERATION_JOB, { commentId: 1 })
  })
})
