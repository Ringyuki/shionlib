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
      galgameIds: jest.fn().mockResolvedValue({ ids: [] }),
      galgameBatch: jest.fn().mockResolvedValue([]),
      safeGalgameIds: jest.fn().mockResolvedValue(null),
    }
    const cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    }

    return {
      engine: new HikarinagiSearchEngine(prisma as any, hikarinagi as any, cache as any),
      prisma,
      hikarinagi,
      cache,
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

  describe('tag search', () => {
    it('resolves a tag through the ids endpoint instead of the keyword search', async () => {
      const { engine, hikarinagi } = createEngine()
      hikarinagi.galgameIds.mockResolvedValue({ ids: [11, 22, 33] })

      const result = await engine.searchGames(
        { tag: '拔作', page: 1, pageSize: 2 } as any,
        UserContentLimit.NEVER_SHOW_NSFW_CONTENT,
      )

      expect(hikarinagi.searchGalgameIds).not.toHaveBeenCalled()
      expect(hikarinagi.galgameIds).toHaveBeenCalledWith({
        tags: ['拔作'],
        content_limit: UserContentLimit.NEVER_SHOW_NSFW_CONTENT,
        exclude_rated_covers: true,
      })
      expect(result.meta.totalItems).toBe(3)
      expect(result.meta.totalPages).toBe(2)
    })

    it('pages the tag result set locally', async () => {
      const { engine, hikarinagi, prisma } = createEngine()
      hikarinagi.galgameIds.mockResolvedValue({ ids: [11, 22, 33] })

      await engine.searchGames(
        { tag: '拔作', page: 2, pageSize: 2 } as any,
        UserContentLimit.JUST_SHOW,
      )

      expect(prisma.game.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ h_id: { in: [33] } }) }),
      )
    })

    it('keeps rated works in the tag result when the reader may see them', async () => {
      const { engine, hikarinagi } = createEngine()
      hikarinagi.galgameIds.mockResolvedValue({ ids: [] })

      await engine.searchGames(
        { tag: '拔作', page: 1, pageSize: 20 } as any,
        UserContentLimit.JUST_SHOW,
      )

      expect(hikarinagi.galgameIds).toHaveBeenCalledWith(
        expect.objectContaining({ exclude_rated_covers: false }),
      )
    })

    it('narrows a keyword search down to the tag when both are given', async () => {
      const { engine, hikarinagi } = createEngine()
      hikarinagi.galgameIds.mockResolvedValue({ ids: [22, 44] })
      hikarinagi.searchGalgameIds.mockResolvedValue({
        ids: [11, 22, 33],
        meta: { total_items: 3, total_pages: 1 },
      })

      const result = await engine.searchGames(
        { q: 'yuzu', tag: '拔作', page: 1, pageSize: 20 } as any,
        UserContentLimit.JUST_SHOW,
      )

      expect(hikarinagi.searchGalgameIds).toHaveBeenCalled()
      expect(result.items).toEqual([])
      expect(hikarinagi.galgameBatch).toHaveBeenCalledWith([22])
    })

    it('returns an empty page when neither a keyword nor a tag is given', async () => {
      const { engine, hikarinagi } = createEngine()

      const result = await engine.searchGames({ page: 1, pageSize: 20 } as any)

      expect(hikarinagi.searchGalgameIds).not.toHaveBeenCalled()
      expect(hikarinagi.galgameIds).not.toHaveBeenCalled()
      expect(result.items).toEqual([])
      expect(result.meta.totalItems).toBe(0)
    })
  })

  describe('only games with download resources', () => {
    const hitsPage = (ids: number[], total_pages: number) => ({
      ids,
      meta: { total_items: ids.length * total_pages, total_pages },
    })

    it('scans the top hits, keeps the ones with active resources and paginates locally', async () => {
      const { engine, prisma, hikarinagi, cache } = createEngine()
      hikarinagi.searchGalgameIds.mockImplementation(({ page }: { page: number }) =>
        Promise.resolve(hitsPage(page === 1 ? [1, 2, 3] : [4, 5, 6], 2)),
      )
      prisma.game.findMany
        .mockResolvedValueOnce([{ h_id: 2 }, { h_id: 5 }, { h_id: 6 }])
        .mockResolvedValueOnce([])

      const result = await engine.searchGames(
        { q: 'yuzu', page: 2, pageSize: 2 } as any,
        UserContentLimit.JUST_SHOW,
        true,
      )

      expect(hikarinagi.searchGalgameIds).toHaveBeenCalledTimes(2)
      expect(hikarinagi.searchGalgameIds).toHaveBeenCalledWith({
        q: 'yuzu',
        page: 2,
        page_size: 100,
        content_limit: UserContentLimit.JUST_SHOW,
      })
      expect(prisma.game.findMany).toHaveBeenNthCalledWith(1, {
        where: {
          status: 1,
          h_id: { in: [1, 2, 3, 4, 5, 6] },
          download_resources: { some: { status: 1 } },
        },
        select: { h_id: true },
      })
      expect(cache.set).toHaveBeenCalledWith(expect.any(String), [2, 5, 6], 5 * 60 * 1000)
      expect(hikarinagi.galgameBatch).toHaveBeenCalledWith([6])
      expect(result.meta).toMatchObject({ totalItems: 3, totalPages: 2, currentPage: 2 })
    })

    it('stops scanning after ten upstream pages', async () => {
      const { engine, hikarinagi } = createEngine()
      hikarinagi.searchGalgameIds.mockImplementation(({ page }: { page: number }) =>
        Promise.resolve(hitsPage([page], 50)),
      )

      await engine.searchGames({ q: 'a', page: 1, pageSize: 20 } as any, undefined, true)

      expect(hikarinagi.searchGalgameIds).toHaveBeenCalledTimes(10)
    })

    it('reuses cached hits without calling upstream again', async () => {
      const { engine, prisma, hikarinagi, cache } = createEngine()
      cache.get.mockResolvedValue([8, 9])

      const result = await engine.searchGames(
        { q: 'yuzu', page: 1, pageSize: 1 } as any,
        UserContentLimit.JUST_SHOW,
        true,
      )

      expect(hikarinagi.searchGalgameIds).not.toHaveBeenCalled()
      expect(prisma.game.findMany).toHaveBeenCalledTimes(1)
      expect(hikarinagi.galgameBatch).toHaveBeenCalledWith([8])
      expect(result.meta).toMatchObject({ totalItems: 2, totalPages: 2 })
    })

    it('filters tag results and the listing gate before paginating', async () => {
      const { engine, prisma, hikarinagi } = createEngine()
      hikarinagi.galgameIds.mockResolvedValue({ ids: [10, 20, 30, 40] })
      hikarinagi.safeGalgameIds.mockResolvedValue([10, 20, 40])
      prisma.game.findMany.mockResolvedValueOnce([{ h_id: 20 }, { h_id: 40 }])

      const result = await engine.searchGames(
        { tag: '拔作', page: 1, pageSize: 20 } as any,
        UserContentLimit.NEVER_SHOW_NSFW_CONTENT,
        true,
      )

      expect(hikarinagi.searchGalgameIds).not.toHaveBeenCalled()
      expect(prisma.game.findMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: expect.objectContaining({ h_id: { in: [10, 20, 40] } }),
        }),
      )
      expect(hikarinagi.galgameBatch).toHaveBeenCalledWith([20, 40])
      expect(result.meta.totalItems).toBe(2)
    })
  })
})
