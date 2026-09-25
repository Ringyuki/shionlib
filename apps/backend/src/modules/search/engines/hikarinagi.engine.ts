import { createHash } from 'node:crypto'
import { PrismaService } from '../../../prisma.service'
import { CacheService } from '../../cache/services/cache.service'
import { HikarinagiClient } from '../../hikarinagi/clients/hikarinagi.client'
import { mapCardToListItem } from '../../hikarinagi/mappers/galgame-read.mapper'
import { UserContentLimit } from '../../user/interfaces/user.interface'
import { includesRated } from '../../user/helpers/content-limit.helper'
import { PaginatedResult } from '../../../shared/interfaces/response/response.interface'
import { IndexedGame } from '../interfaces/index.interface'
import { SearchEngine, SearchQuery } from '../interfaces/search.interface'

export class HikarinagiSearchEngine implements SearchEngine {
  private static readonly RESOURCE_SCAN_PAGES = 10
  private static readonly RESOURCE_SCAN_PAGE_SIZE = 100
  private static readonly RESOURCE_HITS_CACHE_PREFIX = 'search:hikarinagi:resource-hits:'
  private static readonly RESOURCE_HITS_CACHE_TTL_MS = 5 * 60 * 1000

  constructor(
    private readonly prisma: PrismaService,
    private readonly hikarinagi: HikarinagiClient,
    private readonly cache: CacheService,
  ) {}

  async upsertGame(): Promise<void> {}
  async bulkUpsertGames(): Promise<void> {}
  async deleteGame(): Promise<void> {}
  async deleteAllGames(): Promise<void> {}

  private async resolveIds(
    query: SearchQuery,
    page: number,
    pageSize: number,
    content_limit?: UserContentLimit,
    only_games_with_resources = false,
  ): Promise<{ ids: number[]; meta: { total_items: number; total_pages: number } }> {
    const q = query.q?.trim()
    const tag = query.tag?.trim()
    if (!q && !tag) return { ids: [], meta: { total_items: 0, total_pages: 0 } }
    if (only_games_with_resources) {
      return this.paginate(await this.resourceHits(q, tag, content_limit), page, pageSize)
    }
    if (!tag) {
      return this.hikarinagi.searchGalgameIds({ q: q!, page, page_size: pageSize, content_limit })
    }

    const { ids: tagged } = await this.hikarinagi.galgameIds({
      tags: [tag],
      content_limit,
      exclude_rated_covers: !includesRated(content_limit),
    })
    let matched = tagged
    if (q) {
      const hits = await this.hikarinagi.searchGalgameIds({
        q,
        page,
        page_size: pageSize,
        content_limit,
      })
      const taggedSet = new Set(tagged)
      matched = hits.ids.filter(id => taggedSet.has(id))

      return {
        ids: matched,
        meta: { total_items: hits.meta.total_items, total_pages: hits.meta.total_pages },
      }
    }

    return this.paginate(matched, page, pageSize)
  }

  private paginate(ids: number[], page: number, pageSize: number) {
    return {
      ids: ids.slice((page - 1) * pageSize, page * pageSize),
      meta: {
        total_items: ids.length,
        total_pages: Math.ceil(ids.length / pageSize),
      },
    }
  }

  private async resourceHits(
    q: string | undefined,
    tag: string | undefined,
    content_limit?: UserContentLimit,
  ): Promise<number[]> {
    const cacheKey = `${HikarinagiSearchEngine.RESOURCE_HITS_CACHE_PREFIX}${createHash('sha1')
      .update(JSON.stringify({ q, tag, content_limit }))
      .digest('hex')}`
    const cached = await this.cache.get<number[] | null>(cacheKey)
    if (cached) return cached

    let ids = q ? await this.scanSearchHits(q, content_limit) : []
    if (tag) {
      const { ids: tagged } = await this.hikarinagi.galgameIds({
        tags: [tag],
        content_limit,
        exclude_rated_covers: !includesRated(content_limit),
      })
      const taggedSet = new Set(tagged)
      ids = q ? ids.filter(id => taggedSet.has(id)) : tagged
    }

    const safeIds = await this.hikarinagi.safeGalgameIds(content_limit)
    if (safeIds) {
      const safeSet = new Set(safeIds)
      ids = ids.filter(id => safeSet.has(id))
    }

    const hits = await this.withDownloadResources(ids)
    await this.cache.set(cacheKey, hits, HikarinagiSearchEngine.RESOURCE_HITS_CACHE_TTL_MS)

    return hits
  }

  private async scanSearchHits(q: string, content_limit?: UserContentLimit): Promise<number[]> {
    const page_size = HikarinagiSearchEngine.RESOURCE_SCAN_PAGE_SIZE
    const first = await this.hikarinagi.searchGalgameIds({ q, page: 1, page_size, content_limit })
    const pages = Math.min(HikarinagiSearchEngine.RESOURCE_SCAN_PAGES, first.meta.total_pages)
    const rest = await Promise.all(
      Array.from({ length: Math.max(0, pages - 1) }, (_, index) =>
        this.hikarinagi.searchGalgameIds({ q, page: index + 2, page_size, content_limit }),
      ),
    )

    return [...new Set([first, ...rest].flatMap(result => result.ids))]
  }

  private async withDownloadResources(ids: number[]): Promise<number[]> {
    if (!ids.length) return []
    const rows = await this.prisma.game.findMany({
      where: { status: 1, h_id: { in: ids }, download_resources: { some: { status: 1 } } },
      select: { h_id: true },
    })
    const kept = new Set(rows.map(row => row.h_id))

    return ids.filter(id => kept.has(id))
  }

  async searchGames(
    query: SearchQuery,
    content_limit?: UserContentLimit,
    only_games_with_resources = false,
  ): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 10
    const result = await this.resolveIds(
      query,
      page,
      pageSize,
      content_limit,
      only_games_with_resources,
    )

    const safeIds = await this.hikarinagi.safeGalgameIds(content_limit)
    const safeSet = safeIds ? new Set(safeIds) : null
    const visibleIds = safeSet ? result.ids.filter(id => safeSet.has(id)) : result.ids
    const shells = visibleIds.length
      ? await this.prisma.game.findMany({
          where: { h_id: { in: visibleIds }, status: 1 },
          select: { id: true, h_id: true, views: true },
        })
      : []
    const byHikarinagiId = new Map(shells.map(shell => [shell.h_id, shell]))
    const cards = visibleIds.length ? await this.hikarinagi.galgameBatch(visibleIds) : []
    const cardById = new Map(cards.map(card => [card.id, card]))

    const items = visibleIds
      .map(hikarinagiId => {
        const shell = byHikarinagiId.get(hikarinagiId)
        const card = cardById.get(hikarinagiId)
        if (!shell || !card) return null

        return {
          id: shell.id,
          views: shell.views,
          ...mapCardToListItem(card, includesRated(content_limit)),
        }
      })
      .filter(item => item !== null)

    return {
      items,
      meta: {
        totalItems: result.meta.total_items,
        itemCount: items.length,
        itemsPerPage: pageSize,
        totalPages: result.meta.total_pages,
        currentPage: page,
        content_limit,
      },
    } as PaginatedResult<unknown>
  }

  async searchGameTags(query: string, limit = 10): Promise<string[]> {
    const tags = await this.prisma.tag.findMany({
      where: { name: { contains: query, mode: 'insensitive' } },
      orderBy: { count: 'desc' },
      take: limit,
      select: { name: true },
    })

    return tags.map(tag => tag.name)
  }
}

export type { IndexedGame }
