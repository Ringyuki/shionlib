jest.mock('../utils/language-detector.util', () => ({
  detectWalkthroughLanguageFromEditorState: jest.fn(),
}))

import { WalkthroughStatus } from '@prisma/client'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { LLM_WALKTHROUGH_MODERATION_JOB } from '../../moderate/constants/moderation.constants'
import { ActivityType } from '../../activity/dto/create-activity.dto'
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

    const activityService = {
      create: jest.fn().mockResolvedValue(undefined),
    }

    const moderationQueue = {
      add: jest.fn().mockResolvedValue(undefined),
    }

    const service = new WalkthroughService(
      prisma as any,
      renderService as any,
      activityService as any,
      moderationQueue as any,
    )

    return {
      service,
      prisma,
      renderService,
      activityService,
      moderationQueue,
    }
  }

  const mockDetectLanguage = jest.mocked(detectWalkthroughLanguageFromEditorState)

  beforeEach(() => {
    jest.clearAllMocks()
    mockDetectLanguage.mockResolvedValue('zh')
  })

  it('create stores published walkthrough as hidden and enqueues llm moderation', async () => {
    const { service, prisma, renderService, activityService, moderationQueue } = createService()
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
    expect(activityService.create).toHaveBeenCalledWith({
      type: ActivityType.WALKTHROUGH_CREATE,
      user_id: 7,
      game_id: 9,
      walkthrough_id: 101,
    })
    expect(moderationQueue.add).toHaveBeenCalledWith(LLM_WALKTHROUGH_MODERATION_JOB, {
      walkthroughId: 101,
    })
  })

  it('create throws when game does not exist', async () => {
    const { service, prisma, activityService } = createService()
    prisma.game.findUnique.mockResolvedValue(null)

    await expect(
      service.create(
        {
          game_id: 999,
          title: 'No game',
          content: { root: {} },
          status: WalkthroughStatus.DRAFT,
        } as any,
        { user: { sub: 7 } } as any,
      ),
    ).rejects.toMatchObject({
      code: ShionBizCode.GAME_NOT_FOUND,
    })
    expect(activityService.create).not.toHaveBeenCalled()
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

  it('update throws when walkthrough does not exist', async () => {
    const { service, prisma } = createService()
    prisma.walkthrough.findFirst.mockResolvedValue(null)

    await expect(
      service.update(
        404,
        { title: 'x', content: { root: {} }, status: WalkthroughStatus.DRAFT } as any,
        { user: { sub: 1, role: ShionlibUserRoles.USER } } as any,
      ),
    ).rejects.toMatchObject({
      code: ShionBizCode.WALKTHROUGH_NOT_FOUND,
    })
  })

  it('update throws when user is not owner and not admin', async () => {
    const { service, prisma } = createService()
    prisma.walkthrough.findFirst.mockResolvedValue({
      id: 22,
      creator_id: 99,
      status: WalkthroughStatus.DRAFT,
    })

    await expect(
      service.update(
        22,
        { title: 'x', content: { root: {} }, status: WalkthroughStatus.DRAFT } as any,
        { user: { sub: 1, role: ShionlibUserRoles.USER } } as any,
      ),
    ).rejects.toMatchObject({
      code: ShionBizCode.WALKTHROUGH_NOT_OWNER,
    })
  })

  it('does not enqueue moderation for draft create', async () => {
    const { service, prisma, renderService, activityService, moderationQueue } = createService()
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
    expect(activityService.create).toHaveBeenCalledWith({
      type: ActivityType.WALKTHROUGH_CREATE,
      user_id: 3,
      game_id: 5,
      walkthrough_id: 88,
    })
    expect(moderationQueue.add).not.toHaveBeenCalled()
  })

  it('getById throws when walkthrough does not exist', async () => {
    const { service, prisma } = createService()
    prisma.walkthrough.findFirst.mockResolvedValue(null)

    await expect(
      service.getById(1, false, { user: { sub: 1, role: ShionlibUserRoles.USER } } as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.WALKTHROUGH_NOT_FOUND,
    })
  })

  it('getById rejects hidden walkthrough for non-owner non-admin', async () => {
    const { service, prisma } = createService()
    prisma.walkthrough.findFirst.mockResolvedValue({
      id: 1,
      status: WalkthroughStatus.HIDDEN,
      creator: { id: 99 },
    })

    await expect(
      service.getById(1, false, { user: { sub: 1, role: ShionlibUserRoles.USER } } as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.WALKTHROUGH_NOT_OWNER,
    })
  })

  it('getById returns hidden walkthrough for owner and passes withContent=true to select', async () => {
    const { service, prisma } = createService()
    const walkthrough = {
      id: 1,
      title: 'Route',
      status: WalkthroughStatus.HIDDEN,
      creator: { id: 7 },
      content: { root: {} },
    }
    prisma.walkthrough.findFirst.mockResolvedValue(walkthrough)

    await expect(
      service.getById(1, true, { user: { sub: 7, role: ShionlibUserRoles.USER } } as any),
    ).resolves.toBe(walkthrough)

    expect(prisma.walkthrough.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1, status: { not: WalkthroughStatus.DELETED } },
        select: expect.objectContaining({
          content: true,
        }),
      }),
    )
  })

  it('getById returns published walkthrough for guest-like request and passes withContent=false', async () => {
    const { service, prisma } = createService()
    const walkthrough = {
      id: 2,
      status: WalkthroughStatus.PUBLISHED,
      creator: { id: 99 },
      content: false,
    }
    prisma.walkthrough.findFirst.mockResolvedValue(walkthrough)

    await expect(
      service.getById(2, false, { user: { sub: undefined, role: 0 } } as any),
    ).resolves.toBe(walkthrough)

    expect(prisma.walkthrough.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          content: false,
        }),
      }),
    )
  })

  it('delete throws when walkthrough does not exist', async () => {
    const { service, prisma } = createService()
    prisma.walkthrough.findFirst.mockResolvedValue(null)

    await expect(
      service.delete(1, { user: { sub: 1, role: ShionlibUserRoles.USER } } as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.WALKTHROUGH_NOT_FOUND,
    })
  })

  it('delete throws when user is not owner and not admin', async () => {
    const { service, prisma } = createService()
    prisma.walkthrough.findFirst.mockResolvedValue({
      id: 1,
      creator_id: 9,
      status: WalkthroughStatus.DRAFT,
    })

    await expect(
      service.delete(1, { user: { sub: 1, role: ShionlibUserRoles.USER } } as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.WALKTHROUGH_NOT_OWNER,
    })
  })

  it('delete soft-deletes walkthrough for owner', async () => {
    const { service, prisma } = createService()
    prisma.walkthrough.findFirst.mockResolvedValue({
      id: 1,
      creator_id: 7,
      status: WalkthroughStatus.DRAFT,
    })
    prisma.walkthrough.update.mockResolvedValue({ id: 1 })

    await service.delete(1, { user: { sub: 7, role: ShionlibUserRoles.USER } } as any)

    expect(prisma.walkthrough.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: WalkthroughStatus.DELETED },
    })
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
