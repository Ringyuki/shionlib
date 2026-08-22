import { HikarinagiSearchEngine } from './hikarinagi.engine'
import { UserContentLimit } from '../../user/interfaces/user.interface'

describe('HikarinagiSearchEngine', () => {
  const createEngine = () => {
    const prisma = {
      game: { findMany: jest.fn().mockResolvedValue([]) },
      tag: { findMany: jest.fn() },
    }
    const hikarinagi = {
      searchGalgameIds: jest.fn(),
      galgameBatch: jest.fn().mockResolvedValue([]),
      safeGalgameIds: jest.fn().mockResolvedValue(null),
    }

    return {
      engine: new HikarinagiSearchEngine(prisma as any, hikarinagi as any),
      prisma,
      hikarinagi,
    }
  }

  it('drops hits the listing gate hides, so search cannot surface a hidden work', async () => {
    const { engine, prisma, hikarinagi } = createEngine()
    hikarinagi.searchGalgameIds.mockResolvedValue({
      ids: [7, 9],
      meta: { total_items: 2, total_pages: 1 },
    })
    hikarinagi.safeGalgameIds.mockResolvedValue([9])

    await engine.searchGames(
      { q: 'x', page: 1, pageSize: 20 } as any,
      UserContentLimit.NEVER_SHOW_NSFW_CONTENT,
    )

    expect(prisma.game.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { h_id: { in: [9] }, status: 1 } }),
    )
    expect(hikarinagi.galgameBatch).toHaveBeenCalledWith([9])
  })

  it('keeps every hit when the reader may see rated works', async () => {
    const { engine, prisma, hikarinagi } = createEngine()
    hikarinagi.searchGalgameIds.mockResolvedValue({
      ids: [7, 9],
      meta: { total_items: 2, total_pages: 1 },
    })
    hikarinagi.safeGalgameIds.mockResolvedValue(null)

    await engine.searchGames({ q: 'x', page: 1, pageSize: 20 } as any, UserContentLimit.JUST_SHOW)

    expect(prisma.game.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { h_id: { in: [7, 9] }, status: 1 } }),
    )
  })

  it('skips the batch call entirely when nothing survives the gate', async () => {
    const { engine, prisma, hikarinagi } = createEngine()
    hikarinagi.searchGalgameIds.mockResolvedValue({
      ids: [7],
      meta: { total_items: 1, total_pages: 1 },
    })
    hikarinagi.safeGalgameIds.mockResolvedValue([])

    // 游客运行时的真实取值是 0，类型上却只声明了 1/2/3
    const guestLimit = 0 as UserContentLimit
    const result = await engine.searchGames({ q: 'x', page: 1, pageSize: 20 } as any, guestLimit)

    expect(prisma.game.findMany).not.toHaveBeenCalled()
    expect(hikarinagi.galgameBatch).not.toHaveBeenCalled()
    expect(result.items).toEqual([])
  })

  it('echoes the reader content limit in meta so the client knows whether to blur', async () => {
    const { engine, hikarinagi } = createEngine()
    hikarinagi.searchGalgameIds.mockResolvedValue({
      ids: [],
      meta: { total_items: 0, total_pages: 0 },
    })

    const permissive = await engine.searchGames(
      { q: 'x', page: 1, pageSize: 20 } as any,
      UserContentLimit.JUST_SHOW,
    )
    expect(permissive.meta.content_limit).toBe(UserContentLimit.JUST_SHOW)

    const strict = await engine.searchGames(
      { q: 'x', page: 1, pageSize: 20 } as any,
      UserContentLimit.NEVER_SHOW_NSFW_CONTENT,
    )
    expect(strict.meta.content_limit).toBe(UserContentLimit.NEVER_SHOW_NSFW_CONTENT)
  })
})
