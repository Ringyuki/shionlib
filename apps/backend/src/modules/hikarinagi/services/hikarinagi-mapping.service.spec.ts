import { HikarinagiMappingService } from './hikarinagi-mapping.service'

describe('HikarinagiMappingService', () => {
  const meta = (page: number, totalPages: number) => ({
    page,
    page_size: 500,
    total_items: 0,
    item_count: 0,
    total_pages: totalPages,
  })

  const createService = () => {
    const prismaService = {
      game: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    }
    const hikarinagiClient = {
      enabled: true,
      getMapping: jest.fn(),
      lookupByBangumiId: jest.fn(),
    }
    const service = new HikarinagiMappingService(prismaService as never, hikarinagiClient as never)

    return { service, prismaService, hikarinagiClient }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('walks every page reported by meta', async () => {
    const { service, hikarinagiClient } = createService()
    hikarinagiClient.getMapping
      .mockResolvedValueOnce({ items: [], meta: meta(1, 3) })
      .mockResolvedValueOnce({ items: [], meta: meta(2, 3) })
      .mockResolvedValueOnce({ items: [], meta: meta(3, 3) })

    await service.syncMapping()

    expect(hikarinagiClient.getMapping).toHaveBeenCalledTimes(3)
    expect(hikarinagiClient.getMapping.mock.calls.map(c => c[0])).toEqual([1, 2, 3])
  })

  it('aborts without clearing when a page carries no meta', async () => {
    const { service, prismaService, hikarinagiClient } = createService()
    hikarinagiClient.getMapping.mockResolvedValueOnce({ items: [], meta: null })

    const result = await service.syncMapping()

    expect(result).toEqual({ synced: 0, cleared: 0 })
    expect(prismaService.game.updateMany).not.toHaveBeenCalled()
  })

  it('matches games by bangumi id and stores the galgame id', async () => {
    const { service, prismaService, hikarinagiClient } = createService()
    hikarinagiClient.getMapping.mockResolvedValueOnce({
      items: [{ id: 8001, vndb_id: 55317, bangumi_game_id: 218711 }],
      meta: meta(1, 1),
    })
    prismaService.game.findMany.mockResolvedValueOnce([{ id: 1, b_id: '218711', h_id: null }])

    const result = await service.syncMapping()

    expect(prismaService.game.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { b_id: { in: ['218711'] } } }),
    )
    expect(prismaService.game.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { h_id: 8001 },
    })
    expect(result.synced).toBe(1)
  })

  it('leaves an already correct h_id untouched', async () => {
    const { service, prismaService, hikarinagiClient } = createService()
    hikarinagiClient.getMapping.mockResolvedValueOnce({
      items: [{ id: 8001, vndb_id: null, bangumi_game_id: 218711 }],
      meta: meta(1, 1),
    })
    prismaService.game.findMany.mockResolvedValueOnce([{ id: 1, b_id: '218711', h_id: 8001 }])

    await service.syncMapping()

    expect(prismaService.game.update).not.toHaveBeenCalled()
  })

  it('clears h_id for games the walk did not see', async () => {
    const { service, prismaService, hikarinagiClient } = createService()
    hikarinagiClient.getMapping.mockResolvedValueOnce({
      items: [{ id: 8001, vndb_id: null, bangumi_game_id: 218711 }],
      meta: meta(1, 1),
    })
    prismaService.game.findMany.mockResolvedValueOnce([{ id: 1, b_id: '218711', h_id: 8001 }])

    await service.syncMapping()

    expect(prismaService.game.updateMany).toHaveBeenCalledWith({
      where: { h_id: { not: null, notIn: [8001] } },
      data: { h_id: null },
    })
  })

  it('skips the sync entirely when the client is not configured', async () => {
    const { service, prismaService, hikarinagiClient } = createService()
    hikarinagiClient.enabled = false

    const result = await service.syncMapping()

    expect(result).toEqual({ synced: 0, cleared: 0 })
    expect(hikarinagiClient.getMapping).not.toHaveBeenCalled()
    expect(prismaService.game.updateMany).not.toHaveBeenCalled()
  })

  it('returns null and does not write when a lookup finds nothing', async () => {
    const { service, prismaService, hikarinagiClient } = createService()
    hikarinagiClient.lookupByBangumiId.mockResolvedValueOnce(null)

    await expect(service.resolveByBangumiId(1, '218711')).resolves.toBeNull()
    expect(prismaService.game.update).not.toHaveBeenCalled()
  })

  it('swallows a lookup failure so the caller is not broken', async () => {
    const { service, hikarinagiClient } = createService()
    hikarinagiClient.lookupByBangumiId.mockRejectedValueOnce(new Error('ECONNREFUSED'))

    await expect(service.resolveByBangumiId(1, '218711')).resolves.toBeNull()
  })
})
