import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { HikarinagiClient } from '../clients/hikarinagi.client'
import { GalgameMappingEntry } from '../interfaces/galgame-mapping.interface'

@Injectable()
export class HikarinagiMappingService {
  private static readonly PAGE_SIZE = 500

  private readonly logger = new Logger(HikarinagiMappingService.name)

  constructor(
    private readonly prismaService: PrismaService,
    private readonly hikarinagiClient: HikarinagiClient,
  ) {}

  async syncMapping(): Promise<{ synced: number; cleared: number }> {
    if (!this.hikarinagiClient.enabled) {
      this.logger.warn('hikarinagi internal api not configured, skip mapping sync')
      return { synced: 0, cleared: 0 }
    }

    const seen = new Set<number>()
    let synced = 0
    let page = 1
    let totalPages = 1

    while (page <= totalPages) {
      const { items, meta } = await this.hikarinagiClient.getMapping(
        page,
        HikarinagiMappingService.PAGE_SIZE,
      )
      totalPages = meta?.total_pages ?? page

      synced += await this.applyPage(items, seen)
      page += 1
    }

    const cleared = await this.clearStale(seen)
    this.logger.log(`hikarinagi mapping synced: ${synced} matched, ${cleared} cleared`)

    return { synced, cleared }
  }

  async resolveByBangumiId(gameId: number, bangumiId: string): Promise<number | null> {
    if (!this.hikarinagiClient.enabled) return null

    const numericBangumiId = this.toNumericId(bangumiId)
    if (numericBangumiId === null) return null

    try {
      const entry = await this.hikarinagiClient.lookupByBangumiId(numericBangumiId)
      if (!entry) return null

      await this.prismaService.game.update({
        where: { id: gameId },
        data: { h_id: entry.id },
      })

      return entry.id
    } catch (error) {
      this.logger.warn(
        `hikarinagi lookup failed for game ${gameId} (bgm ${bangumiId}): ${(error as Error).message}`,
      )

      return null
    }
  }

  private async applyPage(items: GalgameMappingEntry[], seen: Set<number>): Promise<number> {
    const byBangumiId = new Map<string, number>()
    for (const item of items) {
      if (item.bangumi_game_id !== null) byBangumiId.set(String(item.bangumi_game_id), item.id)
    }
    if (byBangumiId.size === 0) return 0

    const games = await this.prismaService.game.findMany({
      where: { b_id: { in: [...byBangumiId.keys()] } },
      select: { id: true, b_id: true, h_id: true },
    })

    let matched = 0
    for (const game of games) {
      const galgameId = byBangumiId.get(game.b_id!)
      if (galgameId === undefined) continue

      seen.add(galgameId)
      matched += 1
      if (game.h_id === galgameId) continue

      await this.prismaService.game.update({
        where: { id: game.id },
        data: { h_id: galgameId },
      })
    }

    return matched
  }

  private async clearStale(seen: Set<number>): Promise<number> {
    const result = await this.prismaService.game.updateMany({
      where: { h_id: { not: null, notIn: [...seen] } },
      data: { h_id: null },
    })

    return result.count
  }

  private toNumericId(value: string): number | null {
    const parsed = Number(value)

    return Number.isInteger(parsed) && parsed > 0 ? parsed : null
  }
}
