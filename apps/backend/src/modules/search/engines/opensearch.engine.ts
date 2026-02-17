import { Injectable, Logger } from '@nestjs/common'
import { SearchEngine } from '../interfaces/search.interface'
import { OpenSearchService } from '../services/opensearch.service'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { IndexedGame } from '../interfaces/index.interface'
import { SearchQuery } from '../interfaces/search.interface'
import { UserContentLimit } from '../../user/interfaces/user.interface'
import { PaginatedResult } from '../../../shared/interfaces/response/response.interface'
import { GameItemResDto } from '../dto/res/game-item.res.dto'
import { CacheService } from '../../cache/services/cache.service'

@Injectable()
export class OpenSearchEngine implements SearchEngine {
  private readonly logger = new Logger(OpenSearchEngine.name)
  constructor(
    private readonly opensearchService: OpenSearchService,
    private readonly configService: ShionConfigService,
    private readonly cacheService: CacheService,
  ) {
    this.opensearchService.onModuleInit()
  }

  private get indexName() {
    return this.configService.get('search.opensearch.indexName')
  }

  async upsertGame(doc: IndexedGame): Promise<void> {
    const client = this.opensearchService.getClient()
    if (!client) return
    await this.opensearchService.ensureIndex(this.indexName, true)
    await client.index({
      index: this.indexName,
      id: String(doc.id),
      body: doc,
      refresh: false,
    })
    await this.cacheService.delByContains(`game:${doc.id}`)
  }

  // async bulkUpsertGames(docs: IndexedGame[]): Promise<void> {
  //   try {
  //     const client = this.opensearchService.getClient()
  //     if (!client || !docs.length) return
  //     await this.opensearchService.ensureIndex(this.indexName, true)
  //     const status: BulkStats = await client.helpers.bulk({
  //       datasource: docs,
  //       onDocument: doc => {
  //         return {
  //           index: {
  //             _index: this.indexName,
  //             _id: String(doc.id),
  //           },
  //         }
  //       },
  //     })
  //     if (status.failed > 0) {
  //       console.log(status)
  //       throw new Error('Failed to bulk upsert games')
  //     }
  //     this.logger.log(`Bulk upserted ${docs.length} games`)
  //   } catch (error) {
  //     this.logger.error('Failed to bulk upsert games', error)
  //     throw error
  //   }
  // }

  async bulkUpsertGames(docs: IndexedGame[]): Promise<void> {
    const client = this.opensearchService.getClient()
    if (!client || !docs.length) return
    await this.opensearchService.ensureIndex(this.indexName, true)

    const body = docs.flatMap(d => [{ index: { _index: this.indexName, _id: String(d.id) } }, d])

    const res = await client.bulk({ body })
    if (res.body?.errors) {
      const firstErr = res.body.items?.find((i: any) => i.index && i.index.error)?.index?.error
      this.logger.error(`Bulk upsert had errors: ${JSON.stringify(firstErr)}`)
    }
    await this.opensearchService.refresh(this.indexName)
  }

  async deleteGame(id: number): Promise<void> {
    const client = this.opensearchService.getClient()
    if (!client) return
    await client.delete({ index: this.indexName, id: String(id) })
  }

  async deleteAllGames(): Promise<void> {
    const client = this.opensearchService.getClient()
    if (!client) return
    await this.opensearchService.ensureIndex(this.indexName, true)

    await client.deleteByQuery({
      index: this.indexName,
      body: { query: { match_all: {} } },
      refresh: true,
      conflicts: 'proceed',
    })
  }

  async searchGames(
    query: SearchQuery,
    content_limit?: UserContentLimit,
  ): Promise<PaginatedResult<GameItemResDto>> {
    const client = this.opensearchService.getClient()
    if (!client || !query.q) {
      return {
        items: [],
        meta: {
          totalItems: 0,
          itemCount: 0,
          itemsPerPage: query.pageSize,
          totalPages: 0,
          currentPage: query.page,
        },
      }
    }

    await this.opensearchService.ensureIndex(this.indexName, false)

    const { page, pageSize, q } = query
    const from = Math.max(0, (page - 1) * pageSize)

    const filters: any[] = []
    if (content_limit === UserContentLimit.NEVER_SHOW_NSFW_CONTENT || !content_limit) {
      filters.push({ term: { nsfw: false } })
      filters.push({ term: { max_cover_sexual: 0 } })
    }

    const sQuery = {
      _source: [
        'id',
        'title_jp',
        'title_zh',
        'title_en',
        'aliases',
        'covers',
        'developers',
        'release_date',
      ],
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query: q,
                fields: [
                  'title_jp^5',
                  'title_zh^5',
                  'title_en^5',
                  'aliases^5',
                  'intro_jp',
                  'intro_zh',
                  'intro_en',
                  'tags^2',
                  'developers.name^3',
                  'character_names_jp',
                  'character_names_en',
                  'character_names_zh',
                  'character_aliases',
                  'character_intros_jp',
                  'character_intros_en',
                  'character_intros_zh',
                  'staffs',
                ],
                type: 'best_fields' as const,
                fuzziness: 'AUTO' as const,
                operator: 'OR' as const,
              },
            },
            // {
            //   nested: {
            //     path: 'staffs',
            //     query: {
            //       multi_match: {
            //         query: q,
            //         fields: ['staffs.name^3', 'staffs.role'],
            //       },
            //     },
            //     score_mode: 'max' as const,
            //   },
            // },
          ],
          filter: filters,
        },
      },
      highlight: {
        pre_tags: ['<span class="search-highlight">'],
        post_tags: ['</span>'],
        fields: {
          title_jp: {},
          title_zh: {},
          title_en: {},
          intro_jp: {},
          intro_zh: {},
          intro_en: {},
          aliases: {},
        },
      },
    }

    const res = await client.search({
      index: this.indexName,
      from,
      size: pageSize,
      body: sQuery,
    })

    const hits = res.body?.hits?.hits ?? []
    const total =
      typeof res.body?.hits?.total === 'number'
        ? res.body.hits.total
        : (res.body?.hits?.total?.value ?? 0)

    const items = hits.map(h => {
      const src = h._source || {}
      const hl = h.highlight || {}
      const _formatted: Record<string, string> = {}
      ;['title_jp', 'title_zh', 'title_en', 'intro_jp', 'intro_zh', 'intro_en', 'aliases'].forEach(
        f => {
          if (hl[f]?.length) _formatted[f] = hl[f][0]
        },
      )

      return {
        ...src,
        developers: (src.developers || []).map(d => ({
          developer: { id: d.id, name: d.name },
        })),
        _formatted,
      }
    })

    const totalPages = pageSize ? Math.ceil(total / pageSize) : 0

    return {
      items: items as unknown as GameItemResDto[],
      meta: {
        totalItems: total,
        itemCount: items.length,
        itemsPerPage: pageSize,
        totalPages,
        currentPage: page,
      },
    }
  }

  async searchGameTags(query: string, limit?: number): Promise<string[]> {
    const client = this.opensearchService.getClient()
    if (!client) return []
    const size = Math.max(1, Math.min(limit ?? 10, 100))

    const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const include = query ? `${escapeRegex(query)}.*` : '.*'

    const res = await client.search({
      index: this.indexName,
      size: 0,
      body: {
        aggs: {
          tag_suggest: {
            terms: {
              field: 'tags',
              size: size * 5,
              include,
              order: { _count: 'desc' },
            },
          },
        },
      },
    })

    const buckets = (res.body as any).aggregations?.tag_suggest?.buckets ?? []
    const hits = buckets.map((b: any) => ({ value: b.key as string, count: b.doc_count as number }))
    const ranked = hits
      .sort((a: any, b: any) => {
        const ax = a.value === query ? 2 : a.value.startsWith(query) ? 1 : 0
        const bx = b.value === query ? 2 : b.value.startsWith(query) ? 1 : 0
        if (ax !== bx) return bx - ax
        if (a.count !== b.count) return b.count - a.count
        if (a.value.length !== b.value.length) return a.value.length - b.value.length
        return a.value.localeCompare(b.value)
      })
      .slice(0, size)
    return ranked.map(r => r.value)
  }
}
