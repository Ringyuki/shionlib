import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { HttpService } from '@nestjs/axios'
import { firstValueFrom } from 'rxjs'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { CloudflareAnalyticsData, CloudflareGraphQLResponse } from '../interfaces/cf.interface'

@Injectable()
export class DataService {
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
    const bytes_gotten = await this.getCloudflareAnalytics()
    return {
      games,
      files,
      resources,
      storage: Number(storage._sum.file_size) || 0,
      bytes_gotten: Number(bytes_gotten.summary.totalEdgeResponseBytes) || 0,
    }
  }

  private async getCloudflareAnalytics() {
    const zoneId = this.configService.get('cloudflare.analytics.zone_id')
    const secret = this.configService.get('cloudflare.analytics.secret')
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

    let totalRequests = 0
    let totalVisits = 0
    let totalEdgeResponseBytes = 0

    for (const z of payload.data?.viewer.zones ?? []) {
      for (const g of z.httpRequestsAdaptiveGroups ?? []) {
        totalRequests += g.count ?? 0
        totalVisits += g.sum?.visits ?? 0
        totalEdgeResponseBytes += g.sum?.edgeResponseBytes ?? 0
      }
    }

    return {
      ...payload.data,
      summary: {
        totalRequests,
        totalVisits,
        totalEdgeResponseBytes,
      },
    }
  }
}
