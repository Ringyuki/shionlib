import { of } from 'rxjs'
import { PrismaService } from '../../../prisma.service'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { DataService } from './data.service'

describe('DataService', () => {
  function createService(options?: {
    aggregateFileSize?: number | null
    cloudflareData?: any
    cloudflareErrors?: Array<{ message: string }>
  }) {
    const prisma = {
      game: {
        count: jest.fn().mockResolvedValue(10),
      },
      gameDownloadResourceFile: {
        count: jest.fn().mockResolvedValue(20),
        aggregate: jest.fn().mockResolvedValue({
          _sum: {
            file_size: options && 'aggregateFileSize' in options ? options.aggregateFileSize : 1234,
          },
        }),
      },
      gameDownloadResource: {
        count: jest.fn().mockResolvedValue(30),
      },
    } as unknown as PrismaService

    const post = jest.fn().mockReturnValue(
      of({
        data: {
          data: options?.cloudflareData ?? {
            viewer: {
              zones: [
                {
                  httpRequestsAdaptiveGroups: [
                    {
                      dimensions: { datetimeHour: '2026-02-18T00:00:00Z' },
                      count: 5,
                      sum: { visits: 3, edgeResponseBytes: 100 },
                    },
                    {
                      dimensions: { datetimeHour: '2026-02-18T01:00:00Z' },
                      count: 7,
                      sum: { visits: 4, edgeResponseBytes: 200 },
                    },
                  ],
                },
              ],
            },
          },
          errors: options?.cloudflareErrors,
        },
      }),
    )

    const httpService = {
      post,
    }

    const config = {
      get: jest.fn((key: string) => {
        if (key === 'cloudflare.analytics.zone_id') return 'zone-id'
        if (key === 'cloudflare.analytics.secret') return 'secret-token'
        return undefined
      }),
    } as unknown as ShionConfigService

    const service = new DataService(prisma, httpService as any, config)

    return {
      service,
      prisma,
      post,
      config,
    }
  }

  it('returns overview with aggregated cloudflare bytes', async () => {
    const { service, prisma, post } = createService()

    const result = await service.getOverview()

    expect(prisma.game.count).toHaveBeenCalledWith({ where: { status: 1 } })
    expect(prisma.gameDownloadResourceFile.count).toHaveBeenCalledWith({
      where: {
        OR: [{ file_status: 3, type: 1 }, { type: 2 }, { type: 3 }],
      },
    })
    expect(prisma.gameDownloadResource.count).toHaveBeenCalledWith({
      where: { game: { status: 1 } },
    })
    expect(prisma.gameDownloadResourceFile.aggregate).toHaveBeenCalledWith({
      where: {
        file_status: 3,
        type: 1,
      },
      _sum: {
        file_size: true,
      },
    })

    expect(post).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/graphql',
      expect.objectContaining({
        query: expect.stringContaining('query ZoneTrafficLast24h'),
        variables: expect.objectContaining({
          zoneTag: 'zone-id',
          filter: expect.objectContaining({ requestSource: 'eyeball' }),
        }),
      }),
      {
        headers: {
          Authorization: 'Bearer secret-token',
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 15000,
      },
    )

    expect(result).toEqual({
      games: 10,
      files: 20,
      resources: 30,
      storage: 1234,
      bytes_gotten: 300,
    })
  })

  it('falls back to 0 when storage or cloudflare bytes are missing', async () => {
    const { service } = createService({
      aggregateFileSize: null,
      cloudflareData: {
        viewer: {
          zones: [],
        },
      },
    })

    const result = await service.getOverview()

    expect(result.storage).toBe(0)
    expect(result.bytes_gotten).toBe(0)
  })

  it('throws when cloudflare graphql returns errors', async () => {
    const { service } = createService({
      cloudflareErrors: [{ message: 'bad query' }, { message: 'invalid token' }],
    })

    await expect(service.getOverview()).rejects.toThrow(
      'Cloudflare GraphQL error: bad query; invalid token',
    )
  })
})
