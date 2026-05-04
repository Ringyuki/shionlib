import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { HttpService } from '@nestjs/axios'
import { firstValueFrom } from 'rxjs'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import {
  CloudflareAnalyticsData,
  CloudflareAnalyticsResult,
  CloudflareGraphQLResponse,
  AnalyticsEngineSqlResponse,
  AnalyticsEngineSqlGenericResponse,
} from '../interfaces/cf.interface'
import { GetTrafficDetailResDto } from '../dto/get-traffic-detail.res.dto'

@Injectable()
export class DataService {
  private readonly logger = new Logger(DataService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly configService: ShionConfigService,
  ) {}

  async getOverview() {
    const games = await this.prisma.game.count({
      where: {
        status: 1,
      },
    })
    const files = await this.prisma.gameDownloadResourceFile.count({
      where: {
        OR: [
          {
            file_status: 3,
            type: 1,
          },
          {
            type: 2,
          },
          {
            type: 3,
          },
        ],
      },
    })
    const resources = await this.prisma.gameDownloadResource.count({
      where: {
        game: {
          status: 1,
        },
      },
    })
    const storage = await this.prisma.gameDownloadResourceFile.aggregate({
      where: {
        file_status: 3,
        type: 1,
      },
      _sum: {
        file_size: true,
      },
    })
    const bytes_gotten = await this.getDownloadBytes()
    return {
      games,
      files,
      resources,
      storage: Number(storage._sum.file_size) || 0,
      bytes_gotten,
    }
  }

  private async getDownloadBytes(): Promise<number> {
    const mode = this.configService.get('file_download.mode')
    if (mode === 'worker') {
      return this.getDownloadBytesFromAnalyticsEngine()
    }
    const result = await this.getDownloadBytesFromZoneAnalytics()
    return result.summary.totalEdgeResponseBytes
  }

  private formatTimestampForClickhouse(date: Date): string {
    return date
      .toISOString()
      .replace('T', ' ')
      .replace(/\.\d+Z$/, '')
  }

  private startOfHour(date: Date): Date {
    const hour = new Date(date)
    hour.setMinutes(0, 0, 0)
    return hour
  }

  private async getDownloadBytesFromAnalyticsEngine(): Promise<number> {
    const accountId = this.configService.get('cloudflare.account_id')
    const secret = this.configService.get('cloudflare.analytics.secret')

    if (!accountId || !secret) {
      this.logger.warn(
        'Cloudflare config missing (CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_ANALYTICS_SECRET), fallback to zero bytes',
      )
      return 0
    }

    try {
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`
      const since = this.formatTimestampForClickhouse(new Date(Date.now() - 24 * 60 * 60 * 1000))
      const query = `SELECT SUM(double1) AS totalBytes FROM shionlib_downloads WHERE timestamp >= toDateTime('${since}')`

      const response = await firstValueFrom(
        this.httpService.post<AnalyticsEngineSqlResponse>(endpoint, query, {
          headers: {
            Authorization: `Bearer ${secret}`,
            'Content-Type': 'text/plain',
          },
          timeout: 15_000,
        }),
      )

      return response.data?.data?.[0]?.totalBytes ?? 0
    } catch (error) {
      this.logger.warn(
        `Failed to query download analytics: ${error instanceof Error ? error.message : 'unknown error'}`,
      )
      this.logger.error(error)
      return 0
    }
  }

  async getTrafficDetail(): Promise<GetTrafficDetailResDto> {
    const accountId = this.configService.get('cloudflare.account_id')
    const secret = this.configService.get('cloudflare.analytics.secret')

    if (!accountId || !secret) {
      const message =
        'Cloudflare config missing (CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_ANALYTICS_SECRET)'
      this.logger.warn(`${message}, traffic detail unavailable`)
      throw new ShionBizException(
        ShionBizCode.ANALYSIS_TRAFFIC_DETAIL_UNAVAILABLE,
        'shion-biz.ANALYSIS_TRAFFIC_DETAIL_UNAVAILABLE',
        { message },
      )
    }

    try {
      const now = Date.now()
      const currentHour = this.startOfHour(new Date(now))
      const hourlySince = new Date(currentHour.getTime() - 23 * 60 * 60 * 1000)
      const since24h = this.formatTimestampForClickhouse(new Date(now - 24 * 60 * 60 * 1000))
      const since48h = this.formatTimestampForClickhouse(new Date(now - 48 * 60 * 60 * 1000))
      const since24HourlyBuckets = this.formatTimestampForClickhouse(hourlySince)
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`

      const queryOptions = {
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'text/plain',
        },
        timeout: 15_000,
      }

      const [currentRes, prevRes, hourlyRes, topFilesRes, countryRes, gameRes] = await Promise.all([
        firstValueFrom(
          this.httpService.post<
            AnalyticsEngineSqlGenericResponse<{ downloadCount: string; totalBytes: string }>
          >(
            endpoint,
            `SELECT COUNT(DISTINCT blob4) AS downloadCount, SUM(double1) AS totalBytes FROM shionlib_downloads WHERE timestamp >= toDateTime('${since24h}')`,
            queryOptions,
          ),
        ),
        firstValueFrom(
          this.httpService.post<
            AnalyticsEngineSqlGenericResponse<{ downloadCount: string; totalBytes: string }>
          >(
            endpoint,
            `SELECT COUNT(DISTINCT blob4) AS downloadCount, SUM(double1) AS totalBytes FROM shionlib_downloads WHERE timestamp >= toDateTime('${since48h}') AND timestamp < toDateTime('${since24h}')`,
            queryOptions,
          ),
        ),
        firstValueFrom(
          this.httpService.post<
            AnalyticsEngineSqlGenericResponse<{
              hour: string
              downloadCount: string
              totalBytes: string
            }>
          >(
            endpoint,
            `SELECT toStartOfHour(timestamp) AS hour, COUNT(DISTINCT blob4) AS downloadCount, SUM(double1) AS totalBytes FROM shionlib_downloads WHERE timestamp >= toDateTime('${since24HourlyBuckets}') GROUP BY hour ORDER BY hour ASC`,
            queryOptions,
          ),
        ),
        firstValueFrom(
          this.httpService.post<
            AnalyticsEngineSqlGenericResponse<{
              fileId: string
              fileName: string
              downloadCount: string
              totalBytes: string
            }>
          >(
            endpoint,
            `SELECT index1 AS fileId, blob1 AS fileName, COUNT(DISTINCT blob4) AS downloadCount, SUM(double1) AS totalBytes FROM shionlib_downloads WHERE timestamp >= toDateTime('${since24h}') GROUP BY fileId, fileName ORDER BY totalBytes DESC LIMIT 10`,
            queryOptions,
          ),
        ),
        firstValueFrom(
          this.httpService.post<
            AnalyticsEngineSqlGenericResponse<{
              country: string
              downloadCount: string
              totalBytes: string
            }>
          >(
            endpoint,
            `SELECT blob3 AS country, COUNT(DISTINCT blob4) AS downloadCount, SUM(double1) AS totalBytes FROM shionlib_downloads WHERE timestamp >= toDateTime('${since24h}') AND blob3 != '' GROUP BY country ORDER BY totalBytes DESC LIMIT 20`,
            queryOptions,
          ),
        ),
        firstValueFrom(
          this.httpService.post<
            AnalyticsEngineSqlGenericResponse<{
              gameId: string
              downloadCount: string
              totalBytes: string
            }>
          >(
            endpoint,
            `SELECT blob2 AS gameId, COUNT(DISTINCT blob4) AS downloadCount, SUM(double1) AS totalBytes FROM shionlib_downloads WHERE timestamp >= toDateTime('${since24h}') AND blob2 != '' GROUP BY gameId ORDER BY totalBytes DESC LIMIT 10`,
            queryOptions,
          ),
        ),
      ])

      const current = currentRes.data?.data?.[0] ?? { downloadCount: 0, totalBytes: 0 }
      const prev = prevRes.data?.data?.[0] ?? { downloadCount: 0, totalBytes: 0 }

      const totalDownloads = Number(current.downloadCount) || 0
      const totalBytes = Number(current.totalBytes) || 0
      const prevTotalDownloads = Number(prev.downloadCount) || 0
      const prevTotalBytes = Number(prev.totalBytes) || 0

      const hourly = this.fillHourlyGaps(hourlyRes.data?.data ?? [], hourlySince, currentHour)

      const rawGames = (gameRes.data?.data ?? []).filter(g => g.gameId)
      const gameIds = rawGames.map(g => Number(g.gameId)).filter(id => id > 0)
      const gameNameMap = new Map<
        number,
        { title_jp: string | null; title_zh: string | null; title_en: string | null }
      >()
      if (gameIds.length > 0) {
        const games = await this.prisma.game.findMany({
          where: { id: { in: gameIds } },
          select: { id: true, title_jp: true, title_zh: true, title_en: true },
        })
        for (const g of games) {
          gameNameMap.set(g.id, {
            title_jp: g.title_jp,
            title_zh: g.title_zh,
            title_en: g.title_en,
          })
        }
      }

      return {
        totalDownloads,
        totalBytes,
        averageSize: totalDownloads > 0 ? Math.round(totalBytes / totalDownloads) : 0,
        prevTotalDownloads,
        prevTotalBytes,
        prevAverageSize:
          prevTotalDownloads > 0 ? Math.round(prevTotalBytes / prevTotalDownloads) : 0,
        hourly,
        topFiles: (topFilesRes.data?.data ?? []).map(f => ({
          fileId: f.fileId ?? '',
          fileName: f.fileName ?? '',
          totalBytes: Number(f.totalBytes) || 0,
          downloadCount: Number(f.downloadCount) || 0,
        })),
        countries: (countryRes.data?.data ?? []).map(c => ({
          country: c.country ?? '',
          totalBytes: Number(c.totalBytes) || 0,
          downloadCount: Number(c.downloadCount) || 0,
        })),
        topGames: rawGames.map(g => {
          const id = Number(g.gameId)
          return {
            gameId: id,
            gameName: gameNameMap.get(id) ?? { title_jp: null, title_zh: null, title_en: null },
            totalBytes: Number(g.totalBytes) || 0,
            downloadCount: Number(g.downloadCount) || 0,
          }
        }),
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      this.logger.warn(`Failed to query traffic detail: ${message}`)
      this.logger.error(error)
      throw new ShionBizException(
        ShionBizCode.ANALYSIS_TRAFFIC_DETAIL_UNAVAILABLE,
        'shion-biz.ANALYSIS_TRAFFIC_DETAIL_UNAVAILABLE',
        { message },
      )
    }
  }

  private fillHourlyGaps(
    data: Array<{ hour: string; downloadCount: string | number; totalBytes: string | number }>,
    since: Date,
    until: Date,
  ) {
    const map = new Map(data.map(d => [d.hour, d]))
    const result: Array<{ hour: string; totalBytes: number; downloadCount: number }> = []

    const current = new Date(since)
    current.setMinutes(0, 0, 0)

    while (current <= until) {
      const key = current
        .toISOString()
        .replace('T', ' ')
        .replace(/\.\d+Z$/, '')
      const match = map.get(key)
      result.push({
        hour: current.toISOString(),
        totalBytes: Number(match?.totalBytes) || 0,
        downloadCount: Number(match?.downloadCount) || 0,
      })
      current.setHours(current.getHours() + 1)
    }

    return result
  }

  private async getDownloadBytesFromZoneAnalytics(): Promise<CloudflareAnalyticsResult> {
    const zoneId = this.configService.get('cloudflare.analytics.zone_id')
    const secret = this.configService.get('cloudflare.analytics.secret')

    if (!zoneId || !secret) {
      this.logger.warn(
        'Cloudflare analytics config missing (CLOUDFLARE_ANALYTICS_ZONE_ID/CLOUDFLARE_ANALYTICS_SECRET), fallback to zero bytes',
      )
      return {
        viewer: {
          zones: [],
        },
        summary: {
          totalRequests: 0,
          totalVisits: 0,
          totalEdgeResponseBytes: 0,
        },
      }
    }

    const endpoint = 'https://api.cloudflare.com/client/v4/graphql'
    const until = new Date()
    const since = new Date(until.getTime() - 24 * 60 * 60 * 1000)
    const query = `
      query ZoneTrafficLast24h($zoneTag: string, $filter: filter) {
        viewer {
          zones(filter: { zoneTag: $zoneTag }) {
            httpRequestsAdaptiveGroups(
              limit: 2000
              orderBy: [datetimeHour_ASC]
              filter: $filter
            ) {
              dimensions { datetimeHour }
              count
              sum { visits edgeResponseBytes }
            }
          }
        }
      }
    `
    const variables = {
      zoneTag: zoneId,
      filter: {
        datetime_geq: since.toISOString(),
        datetime_lt: until.toISOString(),
        requestSource: 'eyeball',
      },
    }

    const response = await firstValueFrom(
      this.httpService.post<CloudflareGraphQLResponse<CloudflareAnalyticsData>>(
        endpoint,
        { query, variables },
        {
          headers: {
            Authorization: `Bearer ${secret}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          timeout: 15_000,
        },
      ),
    )
    const payload = response.data
    if (payload?.errors?.length) {
      throw new Error(`Cloudflare GraphQL error: ${payload.errors.map(e => e.message).join('; ')}`)
    }
    const data = payload.data ?? {
      viewer: {
        zones: [],
      },
    }

    let totalRequests = 0
    let totalVisits = 0
    let totalEdgeResponseBytes = 0

    for (const z of data.viewer.zones ?? []) {
      for (const g of z.httpRequestsAdaptiveGroups ?? []) {
        totalRequests += g.count ?? 0
        totalVisits += g.sum?.visits ?? 0
        totalEdgeResponseBytes += g.sum?.edgeResponseBytes ?? 0
      }
    }

    return {
      ...data,
      summary: {
        totalRequests,
        totalVisits,
        totalEdgeResponseBytes,
      },
    }
  }
}
