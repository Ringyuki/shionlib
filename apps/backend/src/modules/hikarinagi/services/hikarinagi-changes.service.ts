import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { HikarinagiClient } from '../clients/hikarinagi.client'
import { CacheService } from '../../cache/services/cache.service'
import { GALGAME_BUNDLE_KEY_PREFIX, galgameBundleKey } from '../constants/cache-keys.constant'
import { HikarinagiShellService } from './hikarinagi-shell.service'

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
    private readonly cache: CacheService,
    private readonly configService: ShionConfigService,
    private readonly shells: HikarinagiShellService,
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

  private async applyEvent(event: {
    resource_type: string
    resource_id: number
    kind: string
    merged_to_id: number | null
  }): Promise<void> {
    if (event.resource_type === 'GALGAME') {
      if (event.kind === 'UPSERT') await this.shells.ensure(event.resource_id)
      await this.invalidateGalgame(event.resource_id)
      if (event.kind === 'MERGE' && event.merged_to_id !== null) {
        await this.invalidateGalgame(event.merged_to_id)
      }
      return
    }

    if (event.resource_type === 'CHARACTER' || event.resource_type === 'PRODUCER') {
      await this.cache.delByContains(GALGAME_BUNDLE_KEY_PREFIX)
    }
  }

  private async invalidateGalgame(hikarinagiId: number): Promise<void> {
    await this.cache.del(galgameBundleKey(hikarinagiId))

    const shell = await this.prisma.game.findFirst({
      where: { h_id: hikarinagiId },
      select: { id: true },
    })
    if (shell) await this.cache.delByContains(`game:${shell.id}:`)
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
