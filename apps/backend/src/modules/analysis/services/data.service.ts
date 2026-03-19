import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { HttpService } from '@nestjs/axios'
import { firstValueFrom } from 'rxjs'
import { ShionConfigService } from '../../../common/config/services/config.service'
import {
  CloudflareAnalyticsData,
  CloudflareAnalyticsResult,
  CloudflareGraphQLResponse,
  AnalyticsEngineSqlResponse,
} from '../interfaces/cf.interface'

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
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
        .toISOString()
        .replace('T', ' ')
        .replace(/\.\d+Z$/, '') // the clickhouse requires the timestamp to be in the format YYYY-MM-DD HH:MM:SS
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

  private buildEmptyCloudflareAnalyticsResult(): CloudflareAnalyticsResult {
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

  private async getDownloadBytesFromZoneAnalytics(): Promise<CloudflareAnalyticsResult> {
    const zoneId = this.configService.get('cloudflare.analytics.zone_id')
    const secret = this.configService.get('cloudflare.analytics.secret')

    if (!zoneId || !secret) {
      this.logger.warn(
        'Cloudflare analytics config missing (CLOUDFLARE_ANALYTICS_ZONE_ID/CLOUDFLARE_ANALYTICS_SECRET), fallback to zero bytes',
      )
      return this.buildEmptyCloudflareAnalyticsResult()
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
