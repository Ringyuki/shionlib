import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { HikarinagiClient } from '../clients/hikarinagi.client'

@Injectable()
export class HikarinagiMappingService {
  private readonly logger = new Logger(HikarinagiMappingService.name)

  constructor(
    private readonly prismaService: PrismaService,
    private readonly hikarinagiClient: HikarinagiClient,
  ) {}

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

  private toNumericId(value: string): number | null {
    const parsed = Number(value)

    return Number.isInteger(parsed) && parsed > 0 ? parsed : null
  }
}
