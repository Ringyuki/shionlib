import { Injectable, OnModuleInit, Logger } from '@nestjs/common'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { Client } from '@opensearch-project/opensearch'
import fs from 'fs'

@Injectable()
export class OpenSearchService implements OnModuleInit {
  private client: Client
  private readonly logger = new Logger(OpenSearchService.name)
  private get enabled() {
    return this.configService.get('search.engine') === 'opensearch'
  }
  constructor(private readonly configService: ShionConfigService) {}

  onModuleInit() {
    if (!this.enabled) return
    const host = this.configService.get('search.opensearch.host')
    const protocol = this.configService.get('search.opensearch.protocol')
    const port = this.configService.get('search.opensearch.port')
    const auth = this.configService.get('search.opensearch.auth')
    const caPath = this.configService.get('search.opensearch.caPath')

    if (!host || !protocol || !port || !caPath) {
      this.logger.warn('OpenSearch host/protocol/port/caPath is not set')
      return
    }

    try {
      const node = auth ? `${protocol}://${auth}@${host}:${port}` : `${protocol}://${host}:${port}`
      this.client = new Client({ node, ssl: { ca: caPath ? fs.readFileSync(caPath) : undefined } })
      this.logger.log('OpenSearch client initialized successfully')
    } catch (error) {
      this.logger.error('Failed to initialize OpenSearch client', error)
      throw error
    }
  }

  getClient(): Client {
    return this.client
  }

  async refresh(indexName: string) {
    if (!this.client) return
    await this.client.indices.refresh({ index: indexName })
  }

  async ensureIndex(indexName: string, createIfNotExists: boolean = false) {
    if (!this.client) return
    const exists = await this.client.indices.exists({ index: indexName })
    if (exists.body) return
    if (createIfNotExists) {
      await this.createIndex(indexName)
      return
    }
    this.logger.error(`Index ${indexName} not found, run pnpm reindex:all first`)
    throw new Error(`Index ${indexName} not found, run pnpm reindex:all first`)
  }

  private async createIndex(indexName: string) {
    const body = {
      settings: {
        analysis: {
          tokenizer: {
            shion_edge_ngram: {
              type: 'edge_ngram',
              min_gram: 1,
              max_gram: 20,
              token_chars: ['letter', 'digit'],
            },
          },
          analyzer: {
            shion_ngram_analyzer: {
              tokenizer: 'shion_edge_ngram',
              filter: ['lowercase'],
            },
            shion_search_analyzer: {
              tokenizer: 'standard',
              filter: ['lowercase'],
            },
          },
        },
      },
      mappings: {
        dynamic: 'false',
        properties: {
          id: { type: 'long' },
          release_date: {
            type: 'date',
            format: 'yyyy-MM-dd||strict_date_optional_time||epoch_millis',
          },
          nsfw: { type: 'boolean' },
          max_cover_sexual: { type: 'integer' },
          platform: { type: 'keyword' },

          title_jp: {
            type: 'text',
            analyzer: 'shion_ngram_analyzer',
            search_analyzer: 'shion_search_analyzer',
            fields: { raw: { type: 'keyword', ignore_above: 256 } },
          },
          title_zh: {
            type: 'text',
            analyzer: 'shion_ngram_analyzer',
            search_analyzer: 'shion_search_analyzer',
            fields: { raw: { type: 'keyword', ignore_above: 256 } },
          },
          title_en: {
            type: 'text',
            analyzer: 'shion_ngram_analyzer',
            search_analyzer: 'shion_search_analyzer',
            fields: { raw: { type: 'keyword', ignore_above: 256 } },
          },
          aliases: {
            type: 'text',
            analyzer: 'shion_ngram_analyzer',
            search_analyzer: 'shion_search_analyzer',
          },

          intro_jp: { type: 'text' },
          intro_zh: { type: 'text' },
          intro_en: { type: 'text' },

          tags: { type: 'keyword' },

          developers: {
            type: 'nested',
            properties: {
              id: { type: 'long' },
              name: {
                type: 'text',
                fields: { raw: { type: 'keyword', ignore_above: 256 } },
              },
            },
          },

          character_names_jp: { type: 'text' },
          character_names_en: { type: 'text' },
          character_names_zh: { type: 'text' },
          character_aliases: { type: 'text' },
          character_intros_jp: { type: 'text' },
          character_intros_en: { type: 'text' },
          character_intros_zh: { type: 'text' },

          staffs: {
            type: 'nested',
            properties: {
              name: { type: 'text', fields: { raw: { type: 'keyword', ignore_above: 256 } } },
              role: { type: 'keyword' },
            },
          },

          covers: { type: 'object', enabled: false },
        },
      },
    }

    try {
      await this.client!.indices.create({ index: indexName, body: body as any })
      this.logger.log(`Index ${indexName} created with mappings/settings`)
    } catch (error) {
      this.logger.error('Failed to create index', error)
      throw error
    }
  }
}
