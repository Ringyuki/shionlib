import { WalkthroughStatus } from '@prisma/client'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { LLM_WALKTHROUGH_MODERATION_JOB } from '../../moderate/constants/moderation.constants'
import { AdminWalkthroughService } from './admin-walkthrough.service'

describe('AdminWalkthroughService', () => {
  const createService = () => {
    const prisma = {
      walkthrough: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    }

    const moderationQueue = {
      add: jest.fn(),
    }

    return {
      prisma,
      moderationQueue,
      service: new AdminWalkthroughService(prisma as any, moderationQueue as any),
    }
  }

  it('getWalkthroughList builds query and maps moderation summary', async () => {
    const { service, prisma } = createService()
    const now = new Date('2026-02-25T00:00:00.000Z')

    prisma.walkthrough.findMany.mockResolvedValue([
      {
        id: 1,
        title: 'Route A',
        html: '<p>a</p>',
        lang: 'zh',
        edited: true,
        status: WalkthroughStatus.HIDDEN,
        created: now,
        updated: now,
        creator: { id: 10, name: 'alice', avatar: null, email: 'a@example.com' },
        game: { id: 7, title_jp: 'jp', title_zh: 'zh', title_en: 'en' },
        moderates: [
          {
            id: 100,
            decision: 'BLOCK',
            model: 'gpt',
            top_category: 'ILLICIT',
            max_score: 0.88,
            reason: 'r',
            evidence: 'e',
            created_at: now,
          },
        ],
      },
    ])
    prisma.walkthrough.count.mockResolvedValue(5)

    const result = await service.getWalkthroughList({
      page: 1,
      pageSize: 10,
      search: '123',
      status: WalkthroughStatus.HIDDEN,
      creatorId: 10,
      gameId: 7,
      sortBy: 'created',
      sortOrder: 'desc',
    } as any)

    expect(prisma.walkthrough.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: WalkthroughStatus.HIDDEN,
          creator_id: 10,
          game_id: 7,
          OR: expect.arrayContaining([
            { id: 123 },
            { creator_id: 123 },
            { game_id: 123 },
            { title: { contains: '123', mode: 'insensitive' } },
            { html: { contains: '123', mode: 'insensitive' } },
          ]),
        }),
        orderBy: { created: 'desc' },
        skip: 0,
        take: 10,
      }),
    )
    expect(prisma.walkthrough.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: WalkthroughStatus.HIDDEN }),
      }),
    )

    expect(result).toEqual({
      items: [
        {
          id: 1,
          title: 'Route A',
          html: '<p>a</p>',
          lang: 'zh',
          edited: true,
          status: WalkthroughStatus.HIDDEN,
          created: now,
          updated: now,
          creator: { id: 10, name: 'alice', avatar: null, email: 'a@example.com' },
          game: { id: 7, title_jp: 'jp', title_zh: 'zh', title_en: 'en' },
          moderation: {
            id: 100,
            decision: 'BLOCK',
            model: 'gpt',
            top_category: 'ILLICIT',
            max_score: 0.88,
            reason: 'r',
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

  it('getWalkthroughList uses default sorting and handles missing moderation summary', async () => {
    const { service, prisma } = createService()
    const now = new Date('2026-02-25T00:00:00.000Z')

    prisma.walkthrough.findMany.mockResolvedValue([
      {
        id: 2,
        title: 'Route B',
        html: '<p>b</p>',
        lang: null,
        edited: false,
        status: WalkthroughStatus.PUBLISHED,
        created: now,
        updated: now,
        creator: { id: 11, name: 'bob', avatar: null, email: null },
        game: { id: 8, title_jp: null, title_zh: 'zh', title_en: null },
        moderates: [],
      },
    ])
    prisma.walkthrough.count.mockResolvedValue(1)

    const result = await service.getWalkthroughList({
      page: 2,
      pageSize: 5,
      search: ' route ',
    } as any)

    expect(prisma.walkthrough.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { created: 'desc' },
        skip: 5,
        take: 5,
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { title: { contains: 'route', mode: 'insensitive' } },
            { game: { title_en: { contains: 'route', mode: 'insensitive' } } },
          ]),
        }),
      }),
    )
    expect(result.items[0].moderation).toBeUndefined()
    expect(result.items[0].lang).toBeNull()
    expect(result.meta.currentPage).toBe(2)
  })

  it('getWalkthroughDetail throws when walkthrough does not exist', async () => {
    const { service, prisma } = createService()
    prisma.walkthrough.findUnique.mockResolvedValue(null)

    await expect(service.getWalkthroughDetail(999)).rejects.toMatchObject({
      code: ShionBizCode.WALKTHROUGH_NOT_FOUND,
    })
  })

  it('getWalkthroughDetail maps moderation history', async () => {
    const { service, prisma } = createService()
    const now = new Date('2026-02-25T00:00:00.000Z')

    prisma.walkthrough.findUnique.mockResolvedValue({
      id: 3,
      title: 'Route C',
      html: '<p>c</p>',
      content: { root: {} },
      lang: 'jp',
      edited: false,
      status: WalkthroughStatus.PUBLISHED,
      created: now,
      updated: now,
      creator: { id: 1, name: 'alice', avatar: null, email: 'a@example.com' },
      game: { id: 9, title_jp: 'jp', title_zh: 'zh', title_en: 'en' },
      moderates: [
        {
          id: 5,
          audit_by: 2,
          model: 'gpt',
          decision: 'ALLOW',
          top_category: 'HARASSMENT',
          categories_json: { harassment: false },
          scores_json: null,
          max_score: null,
          reason: null,
          evidence: null,
          created_at: now,
        },
      ],
    })

    const result = await service.getWalkthroughDetail(3)

    expect(result).toMatchObject({
      id: 3,
      lang: 'jp',
      moderations: [
        {
          id: 5,
          audit_by: 2,
          decision: 'ALLOW',
          max_score: null,
          reason: undefined,
          evidence: undefined,
        },
      ],
    })
  })

  it('updateWalkthroughStatus throws when walkthrough does not exist', async () => {
    const { service, prisma } = createService()
    prisma.walkthrough.findUnique.mockResolvedValue(null)

    await expect(
      service.updateWalkthroughStatus(1, { status: WalkthroughStatus.PUBLISHED } as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.WALKTHROUGH_NOT_FOUND,
    })
  })

  it('updateWalkthroughStatus returns early when status is unchanged', async () => {
    const { service, prisma } = createService()
    prisma.walkthrough.findUnique.mockResolvedValue({
      id: 1,
      status: WalkthroughStatus.HIDDEN,
    })

    await service.updateWalkthroughStatus(1, { status: WalkthroughStatus.HIDDEN } as any)

    expect(prisma.walkthrough.update).not.toHaveBeenCalled()
  })

  it('updateWalkthroughStatus updates status when changed', async () => {
    const { service, prisma } = createService()
    prisma.walkthrough.findUnique.mockResolvedValue({
      id: 1,
      status: WalkthroughStatus.HIDDEN,
    })

    await service.updateWalkthroughStatus(1, { status: WalkthroughStatus.PUBLISHED } as any)

    expect(prisma.walkthrough.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: WalkthroughStatus.PUBLISHED },
    })
  })

  it('rescanWalkthrough throws when walkthrough is missing', async () => {
    const { service, prisma } = createService()
    prisma.walkthrough.findUnique.mockResolvedValue(null)

    await expect(service.rescanWalkthrough(10)).rejects.toMatchObject({
      code: ShionBizCode.WALKTHROUGH_NOT_FOUND,
    })
  })

  it('rescanWalkthrough throws when walkthrough is deleted', async () => {
    const { service, prisma } = createService()
    prisma.walkthrough.findUnique.mockResolvedValue({
      id: 10,
      status: WalkthroughStatus.DELETED,
    })

    await expect(service.rescanWalkthrough(10)).rejects.toMatchObject({
      code: ShionBizCode.WALKTHROUGH_NOT_FOUND,
    })
  })

  it('rescanWalkthrough queues llm moderation when walkthrough is valid', async () => {
    const { service, prisma, moderationQueue } = createService()
    prisma.walkthrough.findUnique.mockResolvedValue({
      id: 10,
      status: WalkthroughStatus.HIDDEN,
    })

    await service.rescanWalkthrough(10)

    expect(moderationQueue.add).toHaveBeenCalledWith(LLM_WALKTHROUGH_MODERATION_JOB, {
      walkthroughId: 10,
    })
  })
})
