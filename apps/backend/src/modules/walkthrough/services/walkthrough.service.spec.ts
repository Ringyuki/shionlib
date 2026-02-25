jest.mock('../utils/language-detector.util', () => ({
  detectWalkthroughLanguageFromEditorState: jest.fn(),
}))

import { WalkthroughStatus } from '@prisma/client'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'
import { LLM_WALKTHROUGH_MODERATION_JOB } from '../../moderate/constants/moderation.constants'
import { detectWalkthroughLanguageFromEditorState } from '../utils/language-detector.util'
import { WalkthroughService } from './walkthrough.service'

describe('WalkthroughService', () => {
  const createService = () => {
    const prisma = {
      game: {
        findUnique: jest.fn(),
      },
      walkthrough: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
    }

    const renderService = {
      toHtml: jest.fn(),
    }

    const moderationQueue = {
      add: jest.fn().mockResolvedValue(undefined),
    }

    const service = new WalkthroughService(
      prisma as any,
      renderService as any,
      moderationQueue as any,
    )

    return {
      service,
      prisma,
      renderService,
      moderationQueue,
    }
  }

  const mockDetectLanguage = jest.mocked(detectWalkthroughLanguageFromEditorState)

  beforeEach(() => {
    jest.clearAllMocks()
    mockDetectLanguage.mockResolvedValue('zh')
  })

  it('create stores published walkthrough as hidden and enqueues llm moderation', async () => {
    const { service, prisma, renderService, moderationQueue } = createService()
    prisma.game.findUnique.mockResolvedValue({ id: 9 })
    renderService.toHtml.mockResolvedValue('<p>guide</p>')
    prisma.walkthrough.create.mockResolvedValue({ id: 101, lang: 'zh' })

    await service.create(
      {
        game_id: 9,
        title: '攻略',
        content: { root: {} },
        status: WalkthroughStatus.PUBLISHED,
      } as any,
      { user: { sub: 7 } } as any,
    )

    expect(prisma.walkthrough.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          game_id: 9,
          creator_id: 7,
          status: WalkthroughStatus.HIDDEN,
          html: '<p>guide</p>',
          lang: 'zh',
        }),
      }),
    )
    expect(moderationQueue.add).toHaveBeenCalledWith(LLM_WALKTHROUGH_MODERATION_JOB, {
      walkthroughId: 101,
    })
  })

  it('update stores published walkthrough as hidden and enqueues llm moderation', async () => {
    const { service, prisma, renderService, moderationQueue } = createService()
    prisma.walkthrough.findFirst.mockResolvedValue({
      id: 22,
      creator_id: 7,
      status: WalkthroughStatus.DRAFT,
    })
    renderService.toHtml.mockResolvedValue('<p>updated guide</p>')
    mockDetectLanguage.mockResolvedValueOnce('jp')
    prisma.walkthrough.update.mockResolvedValue({ id: 22, lang: 'jp' })

    await service.update(
      22,
      {
        title: '更新攻略',
        content: { root: {} },
        status: WalkthroughStatus.PUBLISHED,
      } as any,
      { user: { sub: 7, role: ShionlibUserRoles.USER } } as any,
    )

    expect(prisma.walkthrough.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 22 },
        data: expect.objectContaining({
          title: '更新攻略',
          status: WalkthroughStatus.HIDDEN,
          html: '<p>updated guide</p>',
          lang: 'jp',
          edited: true,
        }),
      }),
    )
    expect(moderationQueue.add).toHaveBeenCalledWith(LLM_WALKTHROUGH_MODERATION_JOB, {
      walkthroughId: 22,
    })
  })

  it('does not enqueue moderation for draft create', async () => {
    const { service, prisma, renderService, moderationQueue } = createService()
    prisma.game.findUnique.mockResolvedValue({ id: 5 })
    renderService.toHtml.mockResolvedValue('<p>draft</p>')
    mockDetectLanguage.mockResolvedValueOnce('unknown')
    prisma.walkthrough.create.mockResolvedValue({ id: 88, lang: null })

    await service.create(
      {
        game_id: 5,
        title: 'Draft',
        content: { root: {} },
        status: WalkthroughStatus.DRAFT,
      } as any,
      { user: { sub: 3 } } as any,
    )

    expect(prisma.walkthrough.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: WalkthroughStatus.DRAFT,
          lang: null,
        }),
      }),
    )
    expect(moderationQueue.add).not.toHaveBeenCalled()
  })

  it('getListByGameId only shows published walkthroughs for guests', async () => {
    const { service, prisma } = createService()
    prisma.walkthrough.count.mockResolvedValue(0)
    prisma.walkthrough.findMany.mockResolvedValue([])

    await service.getListByGameId(
      12,
      { page: 1, pageSize: 20 } as any,
      { user: { sub: undefined, role: 0 } } as any,
    )

    expect(prisma.walkthrough.count).toHaveBeenCalledWith({
      where: {
        game_id: 12,
        AND: [{ status: WalkthroughStatus.PUBLISHED }],
      },
    })
    expect(prisma.walkthrough.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          game_id: 12,
          AND: [{ status: WalkthroughStatus.PUBLISHED }],
        },
      }),
    )
  })

  it('getListByGameId lets admin see own hidden walkthroughs while keeping public filters', async () => {
    const { service, prisma } = createService()
    prisma.walkthrough.count.mockResolvedValue(1)
    prisma.walkthrough.findMany.mockResolvedValue([])

    await service.getListByGameId(
      15,
      { page: 1, pageSize: 10 } as any,
      { user: { sub: 42, role: ShionlibUserRoles.ADMIN } } as any,
    )

    const expectedWhere = {
      game_id: 15,
      AND: [
        {
          status: { not: WalkthroughStatus.DELETED },
          OR: [
            { status: { in: [WalkthroughStatus.PUBLISHED, WalkthroughStatus.DRAFT] } },
            { creator_id: 42 },
          ],
        },
      ],
    }

    expect(prisma.walkthrough.count).toHaveBeenCalledWith({ where: expectedWhere })
    expect(prisma.walkthrough.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere }),
    )
  })
})
