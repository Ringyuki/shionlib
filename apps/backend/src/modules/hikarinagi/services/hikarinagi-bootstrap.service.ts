import { Injectable, Logger } from '@nestjs/common'
import { HikarinagiClient } from '../clients/hikarinagi.client'
import { HikarinagiChangesService } from './hikarinagi-changes.service'
import { HikarinagiSyncService } from './hikarinagi-sync.service'

interface BootstrapOptions {
  from?: number
  limit?: number
  dryRun?: boolean
}

interface BootstrapResult {
  cursor: number
  processed: number
  created: number
  claimed: number
  linked: number
  failed: number
  lastId: number
}

@Injectable()
export class HikarinagiBootstrapService {
  private static readonly PAGE_SIZE = 500
  private static readonly PROGRESS_EVERY = 50

  private readonly logger = new Logger(HikarinagiBootstrapService.name)

  constructor(
    private readonly internal: HikarinagiClient,
    private readonly changes: HikarinagiChangesService,
    private readonly sync: HikarinagiSyncService,
  ) {}

  /**
   * Walk every hikarinagi galgame id and mirror it locally. The change cursor is parked at the
   * current high-water mark first, so the events that already describe this content are not
   * replayed afterwards; anything that changes mid-run still arrives through the change stream.
   */
  async run(options: BootstrapOptions = {}): Promise<BootstrapResult> {
    const from = options.from ?? 0
    const dryRun = options.dryRun ?? false
    const result: BootstrapResult = {
      cursor: 0,
      processed: 0,
      created: 0,
      claimed: 0,
      linked: 0,
      failed: 0,
      lastId: from,
    }

    if (!this.internal.enabled) {
      this.logger.warn('hikarinagi internal api not configured, skip bootstrap')
      return result
    }

    result.cursor = dryRun ? await this.changes.latestEventId() : await this.changes.parkCursor()
    this.logger.log(`bootstrap start: cursor=${result.cursor} from=${from} dryRun=${dryRun}`)

    let page = 1
    let totalPages: number | null = null

    while (totalPages === null || page <= totalPages) {
      const { items, meta } = await this.internal.getMapping(
        page,
        HikarinagiBootstrapService.PAGE_SIZE,
      )
      if (!meta) {
        this.logger.warn('hikarinagi mapping page missing meta, aborting bootstrap')
        return result
      }
      totalPages = meta.total_pages

      for (const entry of items) {
        if (entry.id <= from) continue
        if (options.limit && result.processed >= options.limit) return this.finish(result)

        try {
          const report = await this.sync.applyGalgame(entry.id, dryRun)
          if (report) result[report.resolution] += 1
        } catch (error) {
          result.failed += 1
          this.logger.error(`bootstrap h_id=${entry.id} failed: ${String(error)}`)
        }
        result.processed += 1
        result.lastId = entry.id
        if (result.processed % HikarinagiBootstrapService.PROGRESS_EVERY === 0) {
          this.logger.log(`bootstrap progress: ${JSON.stringify(result)}`)
        }
      }
      page += 1
    }

    return this.finish(result)
  }

  private finish(result: BootstrapResult): BootstrapResult {
    this.logger.log(`bootstrap done: ${JSON.stringify(result)}`)
    return result
  }
}
