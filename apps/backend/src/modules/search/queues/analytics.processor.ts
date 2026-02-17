import { Injectable, Logger } from '@nestjs/common'
import { Processor, Process } from '@nestjs/bull'
import { Job } from 'bull'
import { SEARCH_ANALYTICS_QUEUE } from '../constants/analytics'
import { SearchAnalyticsService } from '../services/analytics.service'

@Processor(SEARCH_ANALYTICS_QUEUE)
@Injectable()
export class SearchAnalyticsProcessor {
  private readonly logger = new Logger(SearchAnalyticsProcessor.name)

  constructor(private readonly analytics: SearchAnalyticsService) {}

  @Process(SEARCH_ANALYTICS_QUEUE)
  async handle(job: Job<string>): Promise<void> {
    try {
      await this.analytics.recordSearch(job.data)
    } catch (e) {
      this.logger.error(
        'Failed processing search analytics job',
        e instanceof Error ? e.stack : undefined,
      )
      throw e
    }
  }
}
