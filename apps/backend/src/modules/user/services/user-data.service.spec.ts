import { PrismaService } from '../../../prisma.service'
import { WalkthroughStatus } from '@prisma/client'
import { UserContentLimit } from '../interfaces/user.interface'
import { UserDataService } from './user-data.service'

describe('UserDataService', () => {
  function createService() {
    const prisma = {
      gameDownloadResource: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      gameUploadSession: {
        findMany: jest.fn(),
      },
      comment: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      walkthrough: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      editRecord: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      game: {
        findMany: jest.fn(),
      },
      gameCharacter: {
        findMany: jest.fn(),
      },
      gameDeveloper: {
        findMany: jest.fn(),
      },
    } as unknown as PrismaService

    const service = new UserDataService(prisma)

    return {
      service,
      prisma,
    }
  }

  it('getGameResources applies nsfw filter for restricted user and marks current user status', async () => {
    const { service, prisma } = createService()
    ;(prisma.gameDownloadResource.findMany as jest.Mock).mockResolvedValue([
      {
        id: 1,
        platform: 'pc',
        language: 'ja',
        note: 'note',
        downloads: 99,
        files: [{ file_name: 'f1.zip' }, { file_name: 'f2.zip' }],
        created: new Date('2026-02-18T00:00:00Z'),
        updated: new Date('2026-02-18T01:00:00Z'),
        game: {
          id: 10,
          title_jp: 'jp',
          title_zh: 'zh',
          title_en: 'en',
          developers: [],
          covers: [],
        },
      },
    ])
    ;(prisma.gameUploadSession.findMany as jest.Mock).mockResolvedValue([{ id: 100 }])
    ;(prisma.gameDownloadResource.count as jest.Mock).mockResolvedValue(3)

    const req = { user: { sub: 7, content_limit: UserContentLimit.NEVER_SHOW_NSFW_CONTENT } } as any
    const result = await service.getGameResources(7, req, { page: 2, pageSize: 2 } as any)

    expect(prisma.gameDownloadResource.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 2,
        take: 2,
        where: {
          creator_id: 7,
          game: {
            nsfw: {
              not: true,
            },
          },
        },
      }),
    )

    expect(result).toEqual({
      items: [
        {
          id: 1,
          platform: 'pc',
          language: 'ja',
          note: 'note',
          downloads: 99,
          file_name: 'f1.zip',
          more_than_one_file: true,
          files_count: 2,
          game: {
            id: 10,
            title_jp: 'jp',
            title_zh: 'zh',
            title_en: 'en',
            developers: [],
            covers: [],
          },
          created: new Date('2026-02-18T00:00:00Z'),
          updated: new Date('2026-02-18T01:00:00Z'),
        },
      ],
      meta: {
        totalItems: 3,
        itemCount: 1,
        itemsPerPage: 2,
        totalPages: 2,
        currentPage: 2,
        is_current_user: true,
        has_on_going_session: true,
        content_limit: UserContentLimit.NEVER_SHOW_NSFW_CONTENT,
      },
    })
  })

  it('getGameResources omits nsfw filter for permissive content limit and hides ongoing status for other users', async () => {
    const { service, prisma } = createService()
    ;(prisma.gameDownloadResource.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.gameUploadSession.findMany as jest.Mock).mockResolvedValue([{ id: 100 }])
    ;(prisma.gameDownloadResource.count as jest.Mock).mockResolvedValue(0)

    const req = { user: { sub: 8, content_limit: UserContentLimit.JUST_SHOW } } as any
    const result = await service.getGameResources(7, req, { page: 1, pageSize: 10 } as any)

    const whereArg = (prisma.gameDownloadResource.findMany as jest.Mock).mock.calls[0][0].where
    expect(whereArg.creator_id).toBe(7)
    expect(whereArg.game).toBeUndefined()
    expect(result.meta.is_current_user).toBe(false)
    expect(result.meta.has_on_going_session).toBe(false)
  })

  it('getComments maps is_liked and like_count', async () => {
    const { service, prisma } = createService()
    ;(prisma.comment.count as jest.Mock).mockResolvedValue(2)
    ;(prisma.comment.findMany as jest.Mock).mockResolvedValue([
      {
        id: 1,
        html: '<p>1</p>',
        parent_id: null,
        root_id: null,
        reply_count: 0,
        parent: null,
        liked_users: [{ id: 10 }],
        _count: { liked_users: 3 },
        game: { id: 11, title_jp: 'jp1', title_zh: 'zh1', title_en: 'en1' },
        creator: { id: 7, name: 'u1', avatar: 'a1' },
        created: new Date('2026-02-18T00:00:00Z'),
        updated: new Date('2026-02-18T00:00:00Z'),
      },
      {
        id: 2,
        html: '<p>2</p>',
        parent_id: 1,
        root_id: 1,
        reply_count: 1,
        parent: { id: 1, html: '<p>1</p>', creator: { id: 1, name: 'a', avatar: null } },
        liked_users: [],
        _count: { liked_users: 0 },
        game: { id: 12, title_jp: 'jp2', title_zh: 'zh2', title_en: 'en2' },
        creator: { id: 7, name: 'u1', avatar: 'a1' },
        created: new Date('2026-02-18T01:00:00Z'),
        updated: new Date('2026-02-18T01:00:00Z'),
      },
    ])

    const req = { user: { sub: 7 } } as any
    const result = await service.getComments(7, req, { page: 1, pageSize: 10 } as any)

    expect(prisma.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { creator_id: 7, status: 1 },
        skip: 0,
        take: 10,
      }),
    )
    expect(result.items[0]).toMatchObject({ is_liked: true, like_count: 3 })
    expect(result.items[1]).toMatchObject({ is_liked: false, like_count: 0 })
    expect(result.meta).toMatchObject({ is_current_user: true, totalItems: 2 })
  })

  it('getWalkthroughs allows current user to filter by hidden status', async () => {
    const { service, prisma } = createService()
    const now = new Date('2026-02-26T00:00:00Z')
    ;(prisma.walkthrough.count as jest.Mock).mockResolvedValue(1)
    ;(prisma.walkthrough.findMany as jest.Mock).mockResolvedValue([
      {
        id: 1,
        title: 'Route A',
        lang: 'zh',
        created: now,
        updated: now,
        edited: true,
        status: WalkthroughStatus.HIDDEN,
        game: {
          id: 10,
          title_jp: 'jp',
          title_zh: 'zh',
          title_en: 'en',
          intro_jp: 'intro-jp',
          intro_zh: 'intro-zh',
          intro_en: 'intro-en',
          covers: [],
        },
        creator: { id: 7, name: 'u1', avatar: 'a1' },
      },
    ])

    const req = { user: { sub: 7 } } as any
    const result = await service.getWalkthroughs(7, req, {
      page: 1,
      pageSize: 10,
      status: WalkthroughStatus.HIDDEN,
    } as any)

    expect(prisma.walkthrough.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          creator_id: 7,
          status: WalkthroughStatus.HIDDEN,
        },
        skip: 0,
        take: 10,
        orderBy: { created: 'desc' },
      }),
    )
    expect(result.items[0]).toMatchObject({ id: 1, status: WalkthroughStatus.HIDDEN })
    expect(result.meta).toMatchObject({
      is_current_user: true,
      totalItems: 1,
      content_limit: undefined,
    })
  })

  it('getWalkthroughs restricts other users to published and ignores hidden filter', async () => {
    const { service, prisma } = createService()
    ;(prisma.walkthrough.count as jest.Mock).mockResolvedValue(0)
    ;(prisma.walkthrough.findMany as jest.Mock).mockResolvedValue([])

    const req = { user: { sub: 99 } } as any
    const result = await service.getWalkthroughs(7, req, {
      page: 2,
      pageSize: 5,
      status: WalkthroughStatus.HIDDEN,
    } as any)

    expect(prisma.walkthrough.count).toHaveBeenCalledWith({
      where: {
        creator_id: 7,
        status: { in: [WalkthroughStatus.PUBLISHED] },
      },
    })
    expect(prisma.walkthrough.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          creator_id: 7,
          status: { in: [WalkthroughStatus.PUBLISHED] },
        },
        skip: 5,
        take: 5,
      }),
    )
    expect(result.meta).toMatchObject({
      is_current_user: false,
      currentPage: 2,
      content_limit: undefined,
    })
  })

  it('getEditRecords maps entity info for game/character/developer', async () => {
    const { service, prisma } = createService()
    ;(prisma.editRecord.count as jest.Mock).mockResolvedValue(3)
    ;(prisma.editRecord.findMany as jest.Mock).mockResolvedValue([
      {
        id: 1,
        entity: 'game',
        target_id: 101,
        action: 'UPDATE_SCALAR',
        field_changes: [],
        changes: {},
        relation_type: null,
        created: new Date(),
        updated: new Date(),
      },
      {
        id: 2,
        entity: 'character',
        target_id: 201,
        action: 'UPDATE_SCALAR',
        field_changes: [],
        changes: {},
        relation_type: null,
        created: new Date(),
        updated: new Date(),
      },
      {
        id: 3,
        entity: 'developer',
        target_id: 301,
        action: 'UPDATE_SCALAR',
        field_changes: [],
        changes: {},
        relation_type: null,
        created: new Date(),
        updated: new Date(),
      },
    ])
    ;(prisma.game.findMany as jest.Mock).mockResolvedValue([
      { id: 101, title_jp: 'g-jp', title_zh: 'g-zh', title_en: 'g-en' },
    ])
    ;(prisma.gameCharacter.findMany as jest.Mock).mockResolvedValue([
      { id: 201, name_jp: 'c-jp', name_zh: 'c-zh', name_en: 'c-en' },
    ])
    ;(prisma.gameDeveloper.findMany as jest.Mock).mockResolvedValue([
      { id: 301, name: 'dev', aliases: ['d'] },
    ])

    const result = await service.getEditRecords(7, { page: 1, pageSize: 10 } as any)

    expect(prisma.editRecord.count).toHaveBeenCalledWith({ where: { actor_id: 7 } })
    expect(prisma.game.findMany).toHaveBeenCalledWith({
      where: { id: { in: [101] } },
      select: { id: true, title_jp: true, title_zh: true, title_en: true },
    })
    expect(prisma.gameCharacter.findMany).toHaveBeenCalledWith({
      where: { id: { in: [201] } },
      select: { id: true, name_jp: true, name_zh: true, name_en: true },
    })
    expect(prisma.gameDeveloper.findMany).toHaveBeenCalledWith({
      where: { id: { in: [301] } },
      select: { id: true, name: true, aliases: true },
    })

    expect(result.items[0]).toMatchObject({ entity: 'game', entity_info: { id: 101 } })
    expect(result.items[1]).toMatchObject({ entity: 'character', entity_info: { id: 201 } })
    expect(result.items[2]).toMatchObject({ entity: 'developer', entity_info: { id: 301 } })
    expect(result.meta).toMatchObject({ totalItems: 3, itemCount: 3 })
  })

  it('getEditRecords skips entity lookups when no records', async () => {
    const { service, prisma } = createService()
    ;(prisma.editRecord.count as jest.Mock).mockResolvedValue(0)
    ;(prisma.editRecord.findMany as jest.Mock).mockResolvedValue([])

    const result = await service.getEditRecords(7, { page: 1, pageSize: 10 } as any)

    expect(prisma.game.findMany).not.toHaveBeenCalled()
    expect(prisma.gameCharacter.findMany).not.toHaveBeenCalled()
    expect(prisma.gameDeveloper.findMany).not.toHaveBeenCalled()
    expect(result).toEqual({
      items: [],
      meta: {
        totalItems: 0,
        itemCount: 0,
        itemsPerPage: 10,
        totalPages: 0,
        currentPage: 1,
      },
    })
  })
})
