import { HikarinagiMappingService } from './hikarinagi-mapping.service'

describe('HikarinagiMappingService', () => {
  const createService = () => {
    const prismaService = {
      game: {
        update: jest.fn().mockResolvedValue({}),
      },
    }
    const hikarinagiClient = {
      enabled: true,
      lookupByBangumiId: jest.fn().mockResolvedValue({ id: 8001 }),
    }
    const service = new HikarinagiMappingService(prismaService as any, hikarinagiClient as any)

    return { service, prismaService, hikarinagiClient }
  }

  it('writes the resolved hikarinagi id back onto the local row', async () => {
    const { service, prismaService, hikarinagiClient } = createService()

    await expect(service.resolveByBangumiId(1, '218711')).resolves.toBe(8001)
    expect(hikarinagiClient.lookupByBangumiId).toHaveBeenCalledWith(218711)
    expect(prismaService.game.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { h_id: 8001 },
    })
  })

  it('does not call upstream when the client is not configured', async () => {
    const { service, prismaService, hikarinagiClient } = createService()
    hikarinagiClient.enabled = false

    await expect(service.resolveByBangumiId(1, '218711')).resolves.toBeNull()
    expect(hikarinagiClient.lookupByBangumiId).not.toHaveBeenCalled()
    expect(prismaService.game.update).not.toHaveBeenCalled()
  })

  it('ignores a bangumi id that is not a positive integer', async () => {
    const { service, hikarinagiClient } = createService()

    await expect(service.resolveByBangumiId(1, 'not-a-number')).resolves.toBeNull()
    expect(hikarinagiClient.lookupByBangumiId).not.toHaveBeenCalled()
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
