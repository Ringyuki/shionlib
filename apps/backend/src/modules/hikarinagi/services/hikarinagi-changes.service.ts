import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { HikarinagiClient } from '../clients/hikarinagi.client'
import { HikarinagiSyncService } from './hikarinagi-sync.service'

interface ConsumeResult {
  consumed: number
  applied: number
  failed: number
  cursor: number
}

@Injectable()
export class HikarinagiChangesService {
  private readonly logger = new Logger(HikarinagiChangesService.name)
  private running = false

  constructor(
    private readonly prisma: PrismaService,
    private readonly internal: HikarinagiClient,
    private readonly sync: HikarinagiSyncService,
    private readonly configService: ShionConfigService,
  ) {}

  async consume(): Promise<ConsumeResult> {
    const result: ConsumeResult = { consumed: 0, applied: 0, failed: 0, cursor: 0 }
    if (!this.internal.enabled) return result
    if (this.running) {
      this.logger.warn('previous catalog changes run is still in flight; skipping')
      return result
    }

    this.running = true
    try {
      const batchSize = this.configService.get('hikarinagi.sync.batch_size')
      let cursor = await this.readCursor()

      for (;;) {
        const page = await this.internal.changes(cursor, batchSize)
        if (!page.items.length) {
          result.cursor = cursor
          break
        }

        for (const event of page.items) {
          result.consumed += 1
          try {
            await this.applyEvent(event)
            result.applied += 1
          } catch (error) {
            result.failed += 1
            this.logger.error(
              `catalog event ${event.id} (${event.resource_type}#${event.resource_id}) failed: ${String(error)}`,
            )
          }
          cursor = event.id
          await this.writeCursor(cursor)
        }

        result.cursor = cursor
        if (!page.has_more) break
      }

      this.logger.log(
        `catalog changes consumed=${result.consumed} applied=${result.applied} failed=${result.failed} cursor=${result.cursor}`,
      )
      return result
    } finally {
      this.running = false
    }
  }

  async latestEventId(): Promise<number> {
    const page = await this.internal.changes(0, 1)
    return page.latest_id
  }

  /**
   * Park the cursor at the current high-water mark. Used before a full bootstrap so the backlog
   * that already describes the mirrored content is not replayed once the poller starts.
   */
  async parkCursor(): Promise<number> {
    const latest = await this.latestEventId()
    await this.writeCursor(latest)
    this.logger.log(`catalog cursor parked at ${latest}`)
    return latest
  }

  private async applyEvent(event: {
    resource_type: string
    resource_id: number
    kind: string
    merged_to_id: number | null
  }): Promise<void> {
    if (event.resource_type === 'GALGAME') {
      if (event.kind === 'UPSERT') await this.sync.applyGalgame(event.resource_id)
      else if (event.kind === 'DELETE') await this.sync.hideGalgame(event.resource_id)
      else if (event.kind === 'MERGE' && event.merged_to_id !== null) {
        await this.sync.mergeGalgame(event.resource_id, event.merged_to_id)
      }
      return
    }
    if (event.resource_type === 'CHARACTER' && event.kind === 'UPSERT') {
      await this.sync.applyCharacter(event.resource_id)
      return
    }
    if (event.resource_type === 'PRODUCER' && event.kind === 'UPSERT') {
      await this.sync.applyProducer(event.resource_id)
    }
  }

  private async readCursor(): Promise<number> {
    const state = await this.prisma.hikarinagiSyncState.findUnique({ where: { id: 1 } })
    return state ? Number(state.last_event_id) : 0
  }

  private async writeCursor(value: number): Promise<void> {
    await this.prisma.hikarinagiSyncState.upsert({
      where: { id: 1 },
      create: { id: 1, last_event_id: BigInt(value) },
      update: { last_event_id: BigInt(value), synced_at: new Date() },
    })
  }
}
