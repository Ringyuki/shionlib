import { HikarinagiShellService } from './hikarinagi-shell.service'

describe('HikarinagiShellService', () => {
  const createService = (internalOverrides: Record<string, unknown> = {}) => {
    const prisma = {
      game: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({ id: 1 }),
        create: jest.fn().mockResolvedValue({ id: 1 }),
      },
    }
    const internal = {
      enabled: true,
      lookupById: jest.fn().mockResolvedValue(null),
      ...internalOverrides,
    }
    const config = { get: jest.fn().mockReturnValue(1) }
    const service = new HikarinagiShellService(prisma as any, internal as any, config as any)

    return { service, prisma, internal, config }
  }

  it('does nothing when the internal channel is not configured', async () => {
    const { service, prisma, internal } = createService({ enabled: false })

    await expect(service.ensure(42)).resolves.toBe(false)
    expect(prisma.game.findUnique).not.toHaveBeenCalled()
    expect(internal.lookupById).not.toHaveBeenCalled()
  })

  it('leaves an existing shell alone instead of touching its status', async () => {
    const { service, prisma, internal } = createService()
    prisma.game.findUnique.mockResolvedValueOnce({ id: 19988 })

    await expect(service.ensure(9168)).resolves.toBe(false)
    expect(internal.lookupById).not.toHaveBeenCalled()
    expect(prisma.game.update).not.toHaveBeenCalled()
    expect(prisma.game.create).not.toHaveBeenCalled()
  })

  it('creates a shell carrying the external ids in the shionlib format', async () => {
    const { service, prisma, internal } = createService()
    internal.lookupById.mockResolvedValueOnce({
      id: 9168,
      vndb_id: 53590,
      bangumi_game_id: 524427,
    })

    await expect(service.ensure(9168)).resolves.toBe(true)
    expect(prisma.game.create).toHaveBeenCalledWith({
      data: { h_id: 9168, v_id: 'v53590', b_id: '524427', creator_id: 1 },
      select: { id: true },
    })
  })

  it('creates a shell with null external ids for an entry that has none', async () => {
    const { service, prisma, internal } = createService()
    internal.lookupById.mockResolvedValueOnce({
      id: 9168,
      vndb_id: null,
      bangumi_game_id: null,
    })

    await service.ensure(9168)

    expect(prisma.game.findMany).not.toHaveBeenCalled()
    expect(prisma.game.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ v_id: null, b_id: null }) }),
    )
  })

  it('claims an unclaimed shionlib row rather than creating a duplicate', async () => {
    const { service, prisma, internal } = createService()
    internal.lookupById.mockResolvedValueOnce({
      id: 9168,
      vndb_id: 53590,
      bangumi_game_id: 524427,
    })
    prisma.game.findMany.mockResolvedValueOnce([{ id: 4321 }])

    await expect(service.ensure(9168)).resolves.toBe(true)
    expect(prisma.game.findMany).toHaveBeenCalledWith({
      where: { h_id: null, OR: [{ b_id: '524427' }, { v_id: 'v53590' }] },
      select: { id: true },
      take: 2,
    })
    expect(prisma.game.update).toHaveBeenCalledWith({
      where: { id: 4321 },
      data: { h_id: 9168 },
    })
    expect(prisma.game.create).not.toHaveBeenCalled()
  })

  it('refuses to guess when several unclaimed rows share the external ids', async () => {
    const { service, prisma, internal } = createService()
    internal.lookupById.mockResolvedValueOnce({
      id: 9168,
      vndb_id: 53590,
      bangumi_game_id: 524427,
    })
    prisma.game.findMany.mockResolvedValueOnce([{ id: 4321 }, { id: 4322 }])

    await service.ensure(9168)

    expect(prisma.game.update).not.toHaveBeenCalled()
    expect(prisma.game.create).toHaveBeenCalled()
  })

  it('reports failure instead of throwing when the unique index rejects the row', async () => {
    const { service, prisma, internal } = createService()
    internal.lookupById.mockResolvedValueOnce({
      id: 9168,
      vndb_id: 53590,
      bangumi_game_id: 524427,
    })
    prisma.game.create.mockRejectedValueOnce(new Error('Unique constraint failed'))

    await expect(service.ensure(9168)).resolves.toBe(false)
  })

  it('skips an upstream id that resolves to nothing', async () => {
    const { service, prisma } = createService()

    await expect(service.ensure(9168)).resolves.toBe(false)
    expect(prisma.game.create).not.toHaveBeenCalled()
  })
})
