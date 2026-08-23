import { PartnerDownloadService } from './partner-download.service'

describe('PartnerDownloadService', () => {
  const createService = () => {
    const prismaService = {
      $queryRaw: jest.fn(),
      game: { findMany: jest.fn().mockResolvedValue([]) },
    }
    const gameDownloadSourceService = { issueLink: jest.fn() }
    const service = new PartnerDownloadService(
      prismaService as any,
      gameDownloadSourceService as any,
    )

    return { service, prismaService, gameDownloadSourceService }
  }

  describe('getSummary', () => {
    it('narrows the aggregate bigints the partner contract cannot carry', async () => {
      const { service, prismaService } = createService()
      prismaService.$queryRaw.mockResolvedValueOnce([{ count: 3n }]).mockResolvedValueOnce([
        {
          game_id: 42,
          v_id: 'v53590',
          b_id: '524427',
          resource_count: 2n,
          file_count: 5n,
          total_size: 9007199254740993n,
        },
      ])

      const result = await service.getSummary({ page: 1, pageSize: 20 } as never)

      expect(result.items).toEqual([
        {
          game_id: 42,
          v_id: 'v53590',
          b_id: '524427',
          resource_count: 2,
          file_count: 5,
          total_size: '9007199254740993',
        },
      ])
      expect(result.meta.totalItems).toBe(3)
      expect(result.meta.totalPages).toBe(1)
    })

    it('reports an empty page without inventing a total', async () => {
      const { service, prismaService } = createService()
      prismaService.$queryRaw.mockResolvedValueOnce([{ count: 0n }]).mockResolvedValueOnce([])

      const result = await service.getSummary({ page: 2, pageSize: 10 } as never)

      expect(result.items).toEqual([])
      expect(result.meta).toMatchObject({
        totalItems: 0,
        itemCount: 0,
        totalPages: 0,
        currentPage: 2,
      })
    })
  })

  describe('getByExternalId', () => {
    it('only matches on the external ids the caller actually supplied', async () => {
      const { service, prismaService } = createService()

      await service.getByExternalId('v53590', undefined)
      expect(prismaService.game.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { OR: [{ v_id: 'v53590' }] } }),
      )

      await service.getByExternalId(undefined, '524427')
      expect(prismaService.game.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ where: { OR: [{ b_id: '524427' }] } }),
      )
    })

    it('flattens resources across games and stringifies file sizes', async () => {
      const { service, prismaService } = createService()
      const created = new Date('2026-02-18T00:00:00.000Z')
      prismaService.game.findMany.mockResolvedValueOnce([
        {
          id: 42,
          download_resources: [
            {
              id: 7,
              platform: ['win'],
              language: ['jp'],
              simulator: null,
              note: null,
              downloads: 9,
              created,
              updated: created,
              files: [
                {
                  id: 1,
                  file_name: 'a.7z',
                  file_size: 1234567890123n,
                  file_hash: 'abc',
                  hash_algorithm: 'blake3',
                },
              ],
            },
          ],
        },
        { id: 43, download_resources: [] },
      ])

      const result = await service.getByExternalId('v53590')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: 7,
        game_id: 42,
        simulator: null,
        note: null,
        created: '2026-02-18T00:00:00.000Z',
      })
      expect(result[0].files[0].file_size).toBe('1234567890123')
    })
  })

  it('issueLink hands off to the download resource service', async () => {
    const { service, gameDownloadSourceService } = createService()
    gameDownloadSourceService.issueLink.mockResolvedValue({ url: 'https://cdn/x' })

    await expect(service.issueLink(12)).resolves.toEqual({ url: 'https://cdn/x' })
    expect(gameDownloadSourceService.issueLink).toHaveBeenCalledWith(12)
  })
})
