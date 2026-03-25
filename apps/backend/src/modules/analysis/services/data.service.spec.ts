import { of, throwError } from 'rxjs'
import { PrismaService } from '../../../prisma.service'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { DataService } from './data.service'

describe('DataService', () => {
  function createService(options?: {
    aggregateFileSize?: number | null
    downloadMode?: 'direct' | 'worker'
    cloudflareData?: any
    cloudflareErrors?: Array<{ message: string }>
    cloudflareZoneId?: string
    cloudflareSecret?: string
    cloudflareAccountId?: string
    analyticsBytes?: number
    analyticsError?: boolean
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

    const mode = options?.downloadMode ?? 'direct'

    const post = options?.analyticsError
      ? jest.fn().mockReturnValue(throwError(() => new Error('network error')))
      : jest.fn().mockImplementation((url: string) => {
          if (url.includes('analytics_engine/sql')) {
            return of({
              data: {
                data: [{ totalBytes: options?.analyticsBytes ?? 5000 }],
                meta: [{ name: 'totalBytes', type: 'Float64' }],
                rows: 1,
                rows_before_limit_at_least: 1,
              },
            })
          }
          return of({
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
          })
        })

    const httpService = { post }

    const config = {
      get: jest.fn((key: string) => {
        if (key === 'file_download.mode') return mode
        if (key === 'cloudflare.account_id') return options?.cloudflareAccountId ?? 'acc-123'
        if (key === 'cloudflare.analytics.zone_id') return options?.cloudflareZoneId ?? 'zone-id'
        if (key === 'cloudflare.analytics.secret')
          return options?.cloudflareSecret ?? 'secret-token'
        return undefined
      }),
    } as unknown as ShionConfigService

    const service = new DataService(prisma, httpService as any, config)

    return { service, prisma, post, config }
  }

  describe('direct mode (zone analytics)', () => {
    it('returns overview with aggregated zone bytes', async () => {
      const { service, post } = createService({ downloadMode: 'direct' })

      const result = await service.getOverview()

      expect(post).toHaveBeenCalledWith(
        'https://api.cloudflare.com/client/v4/graphql',
        expect.objectContaining({
          query: expect.stringContaining('query ZoneTrafficLast24h'),
          variables: expect.objectContaining({
            zoneTag: 'zone-id',
            filter: expect.objectContaining({ requestSource: 'eyeball' }),
          }),
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer secret-token',
          }),
        }),
      )

      expect(result.bytes_gotten).toBe(300)
    })

    it('falls back to 0 when zone config is missing', async () => {
      const { service, post } = createService({
        downloadMode: 'direct',
        cloudflareZoneId: '',
        cloudflareSecret: '',
      })
      const warnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation()

      const result = await service.getOverview()

      expect(post).not.toHaveBeenCalled()
      expect(warnSpy).toHaveBeenCalledWith(
        'Cloudflare analytics config missing (CLOUDFLARE_ANALYTICS_ZONE_ID/CLOUDFLARE_ANALYTICS_SECRET), fallback to zero bytes',
      )
      expect(result.bytes_gotten).toBe(0)
    })

    it('throws when zone graphql returns errors', async () => {
      const { service } = createService({
        downloadMode: 'direct',
        cloudflareErrors: [{ message: 'bad query' }, { message: 'invalid token' }],
      })

      await expect(service.getOverview()).rejects.toThrow(
        'Cloudflare GraphQL error: bad query; invalid token',
      )
    })

    it('falls back to 0 when zones array is empty', async () => {
      const { service } = createService({
        downloadMode: 'direct',
        cloudflareData: { viewer: { zones: [] } },
      })

      const result = await service.getOverview()

      expect(result.bytes_gotten).toBe(0)
    })
  })

  describe('worker mode (analytics engine)', () => {
    it('returns overview with download bytes from analytics engine', async () => {
      const { service, post } = createService({
        downloadMode: 'worker',
        analyticsBytes: 9000,
      })

      const result = await service.getOverview()

      expect(post).toHaveBeenCalledWith(
        expect.stringContaining('/accounts/acc-123/analytics_engine/sql'),
        expect.stringContaining('SELECT SUM(double1) AS totalBytes FROM shionlib_downloads'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer secret-token',
            'Content-Type': 'text/plain',
          }),
        }),
      )

      expect(result.bytes_gotten).toBe(9000)
    })

    it('falls back to 0 when account config is missing', async () => {
      const { service, post } = createService({
        downloadMode: 'worker',
        cloudflareAccountId: '',
        cloudflareSecret: '',
      })
      const warnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation()

      const result = await service.getOverview()

      expect(post).not.toHaveBeenCalled()
      expect(warnSpy).toHaveBeenCalledWith(
        'Cloudflare config missing (CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_ANALYTICS_SECRET), fallback to zero bytes',
      )
      expect(result.bytes_gotten).toBe(0)
    })

    it('falls back to 0 when analytics engine query fails', async () => {
      const { service } = createService({
        downloadMode: 'worker',
        analyticsError: true,
      })
      const warnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation()

      const result = await service.getOverview()

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to query download analytics'),
      )
      expect(result.bytes_gotten).toBe(0)
    })
  })

  it('falls back to 0 when storage is null', async () => {
    const { service } = createService({ aggregateFileSize: null })

    const result = await service.getOverview()

    expect(result.storage).toBe(0)
  })

  describe('getTrafficDetail', () => {
    function createTrafficService(options?: {
      cloudflareAccountId?: string
      cloudflareSecret?: string
      analyticsError?: boolean
      currentSummary?: { downloadCount: number; totalBytes: number }
      prevSummary?: { downloadCount: number; totalBytes: number }
      hourlyData?: Array<{ hour: string; downloadCount: number; totalBytes: number }>
      topFilesData?: Array<{
        fileId: string
        fileName: string
        downloadCount: number
        totalBytes: number
      }>
    }) {
      const prisma = {
        game: { count: jest.fn().mockResolvedValue(0) },
        gameDownloadResourceFile: {
          count: jest.fn().mockResolvedValue(0),
          aggregate: jest.fn().mockResolvedValue({ _sum: { file_size: 0 } }),
        },
        gameDownloadResource: { count: jest.fn().mockResolvedValue(0) },
      } as unknown as PrismaService

      let callIndex = 0
      const post = options?.analyticsError
        ? jest.fn().mockReturnValue(throwError(() => new Error('network error')))
        : jest.fn().mockImplementation(() => {
            const index = callIndex++
            if (index === 0) {
              return of({
                data: {
                  data: [options?.currentSummary ?? { downloadCount: 100, totalBytes: 50000 }],
                  meta: [],
                  rows: 1,
                  rows_before_limit_at_least: 1,
                },
              })
            }
            if (index === 1) {
              return of({
                data: {
                  data: [options?.prevSummary ?? { downloadCount: 80, totalBytes: 40000 }],
                  meta: [],
                  rows: 1,
                  rows_before_limit_at_least: 1,
                },
              })
            }
            if (index === 2) {
              return of({
                data: {
                  data: options?.hourlyData ?? [],
                  meta: [],
                  rows: options?.hourlyData?.length ?? 0,
                  rows_before_limit_at_least: options?.hourlyData?.length ?? 0,
                },
              })
            }
            return of({
              data: {
                data: options?.topFilesData ?? [
                  { fileId: '1', fileName: 'game.zip', downloadCount: 50, totalBytes: 25000 },
                  { fileId: '2', fileName: 'patch.zip', downloadCount: 30, totalBytes: 15000 },
                ],
                meta: [],
                rows: 2,
                rows_before_limit_at_least: 2,
              },
            })
          })

      const config = {
        get: jest.fn((key: string) => {
          if (key === 'file_download.mode') return 'worker'
          if (key === 'cloudflare.account_id') return options?.cloudflareAccountId ?? 'acc-123'
          if (key === 'cloudflare.analytics.secret')
            return options?.cloudflareSecret ?? 'secret-token'
          return undefined
        }),
      } as unknown as ShionConfigService

      const service = new DataService(prisma, { post } as any, config)
      return { service, post }
    }

    it('returns full traffic detail with all sections', async () => {
      const { service, post } = createTrafficService()

      const result = await service.getTrafficDetail()

      expect(post).toHaveBeenCalledTimes(4)
      expect(result.totalDownloads).toBe(100)
      expect(result.totalBytes).toBe(50000)
      expect(result.averageSize).toBe(500)
      expect(result.prevTotalDownloads).toBe(80)
      expect(result.prevTotalBytes).toBe(40000)
      expect(result.prevAverageSize).toBe(500)
      expect(result.topFiles).toHaveLength(2)
      expect(result.topFiles[0].fileName).toBe('game.zip')
    })

    it('falls back to empty result when config is missing', async () => {
      const { service, post } = createTrafficService({
        cloudflareAccountId: '',
        cloudflareSecret: '',
      })
      const warnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation()

      const result = await service.getTrafficDetail()

      expect(post).not.toHaveBeenCalled()
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('fallback to empty traffic detail'),
      )
      expect(result.totalDownloads).toBe(0)
      expect(result.totalBytes).toBe(0)
      expect(result.hourly).toEqual([])
      expect(result.topFiles).toEqual([])
    })

    it('falls back to empty result when query fails', async () => {
      const { service } = createTrafficService({ analyticsError: true })
      const warnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation()

      const result = await service.getTrafficDetail()

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to query traffic detail'),
      )
      expect(result.totalDownloads).toBe(0)
      expect(result.topFiles).toEqual([])
    })

    it('returns averageSize 0 when there are zero downloads', async () => {
      const { service } = createTrafficService({
        currentSummary: { downloadCount: 0, totalBytes: 0 },
        prevSummary: { downloadCount: 0, totalBytes: 0 },
      })

      const result = await service.getTrafficDetail()

      expect(result.averageSize).toBe(0)
      expect(result.prevAverageSize).toBe(0)
    })

    it('fills missing hours with zero-value entries', async () => {
      const { service } = createTrafficService({ hourlyData: [] })

      const result = await service.getTrafficDetail()

      expect(result.hourly.length).toBeGreaterThanOrEqual(24)
      expect(result.hourly.every(h => h.totalBytes === 0)).toBe(true)
      expect(result.hourly.every(h => h.downloadCount === 0)).toBe(true)
    })
  })
})
