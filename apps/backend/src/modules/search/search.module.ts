import { Global, Module, forwardRef } from '@nestjs/common'
import { ShionConfigService } from '../../common/config/services/config.service'
import { SEARCH_ENGINE, SearchEngine } from './interfaces/search.interface'
import { PgSearchEngine } from './engines/pg.engine'
import { MeilisearchEngine } from './engines/meilisearch.engine'
import { OpenSearchEngine } from './engines/opensearch.engine'
import { HikarinagiSearchEngine } from './engines/hikarinagi.engine'
import { HikarinagiClient } from '../hikarinagi/clients/hikarinagi.client'
import { OpenSearchService } from './services/opensearch.service'
import { SearchService } from './services/search.service'
import { SearchController } from './controllers/search.controller'
import { PrismaService } from '../../prisma.service'
import { MeilisearchService } from './services/meilisearch.service'
import { SearchAnalyticsTask } from './tasks/analytics.task'
import { SearchAnalyticsService } from './services/analytics.service'
import { SearchAnalyticsProcessor } from './queues/analytics.processor'
import { RedisService } from './services/redis.service'
import { BullModule } from '@nestjs/bull'
import { SEARCH_ANALYTICS_QUEUE } from './constants/analytics'
import { CacheService } from '../cache/services/cache.service'
import { HikarinagiModule } from '../hikarinagi/hikarinagi.module'

@Global()
@Module({
  imports: [
    BullModule.registerQueue({ name: SEARCH_ANALYTICS_QUEUE }),
    forwardRef(() => HikarinagiModule),
  ],
  controllers: [SearchController],
  providers: [
    {
      provide: SEARCH_ENGINE,
      inject: [
        ShionConfigService,
        PrismaService,
        MeilisearchService,
        OpenSearchService,
        CacheService,
        HikarinagiClient,
      ],
      useFactory: (
        config: ShionConfigService,
        prisma: PrismaService,
        meili: MeilisearchService,
        opensearch: OpenSearchService,
        cache: CacheService,
        hikarinagi: HikarinagiClient,
      ): SearchEngine => {
        const engine = config.get('search.engine')
        switch (engine) {
          case 'pg':
            return new PgSearchEngine(prisma, cache)
          case 'meilisearch':
            return new MeilisearchEngine(meili, config, cache)
          case 'opensearch':
            return new OpenSearchEngine(opensearch, config, cache)
          case 'hikarinagi':
            return new HikarinagiSearchEngine(prisma, hikarinagi)
          default:
            throw new Error(`Unsupported search engine: ${engine}`)
        }
      },
    },
    SearchService,
    MeilisearchService,
    OpenSearchService,
    SearchAnalyticsTask,
    RedisService,
    SearchAnalyticsService,
    SearchAnalyticsProcessor,
  ],
  exports: [SEARCH_ENGINE],
})
export class SearchModule {}
