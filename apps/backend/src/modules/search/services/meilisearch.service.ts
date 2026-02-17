import { MeiliSearch } from 'meilisearch'
import { Injectable, OnModuleInit, Logger } from '@nestjs/common'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { Index as MeiliIndex, MeiliSearchApiError } from 'meilisearch'
import type { IndexedGame } from '../interfaces/index.interface'

@Injectable()
export class MeilisearchService implements OnModuleInit {
  private client: MeiliSearch | null = null
  private readonly logger = new Logger(MeilisearchService.name)
  private get enabled() {
    return this.configService.get('search.engine') === 'meilisearch'
  }
  constructor(private readonly configService: ShionConfigService) {}

  async onModuleInit() {
    if (!this.enabled) return
    if (
      !this.configService.get('search.meilisearch.host') ||
      !this.configService.get('search.meilisearch.apiKey')
    ) {
      this.logger.warn('Meilisearch host or api key is not set')
      return
    }

    try {
      this.client = new MeiliSearch({
        host: this.configService.get('search.meilisearch.host'),
        apiKey: this.configService.get('search.meilisearch.apiKey'),
      })
      this.logger.log('Meilisearch client initialized successfully')
    } catch (error) {
      this.logger.error('Failed to initialize Meilisearch client', error)
      throw error
    }
  }

  getClient(): MeiliSearch | null {
    return this.client
  }

  async ensureIndex(indexName: string, createIfNotExists: boolean = false) {
    if (!this.client) return
    let index: MeiliIndex<IndexedGame> | null = null
    try {
      index = await this.client.getIndex(indexName)
      return index
    } catch (error: any) {
      if (error instanceof MeiliSearchApiError && error.response.status === 404) {
        if (createIfNotExists) {
          await this.client.deleteIndex(indexName)
          await this.createIndex(indexName)
          index = await this.client.getIndex(indexName)
          return index
        }
        this.logger.error(`Index ${indexName} not found, run pnpm reindex:all first`)
        throw new Error(`Index ${indexName} not found, run pnpm reindex:all first`)
      }
      throw error
    }
  }

  private async createIndex(indexName: string) {
    await this.client!.createIndex(indexName, { primaryKey: 'id' })
    const index = this.client!.index(indexName)
    await this.updateIndexSettings(index)
  }

  private async updateIndexSettings(index: MeiliIndex<IndexedGame>) {
    await index.updateSettings({
      searchableAttributes: [
        'title_jp',
        'title_zh',
        'title_en',
        'aliases',
        'intro_jp',
        'intro_zh',
        'intro_en',
        'tags',
        'developers_names',
        'developers_aliases',
        'character_names_jp',
        'character_names_en',
        'character_names_zh',
        'character_aliases',
        'character_intros_jp',
        'character_intros_en',
        'character_intros_zh',
        'staffs',
      ],
      filterableAttributes: ['nsfw', 'max_cover_sexual', 'platform', 'tags', 'developers.id'],
      sortableAttributes: ['release_date', 'id', 'title_jp', 'title_zh', 'title_en'],
    })
  }
}
