import { PrismaService } from '../../../prisma.service'
import { HikarinagiClient } from '../../hikarinagi/clients/hikarinagi.client'
import { mapCardToListItem } from '../../hikarinagi/mappers/galgame-read.mapper'
import { UserContentLimit } from '../../user/interfaces/user.interface'
import { includesRated } from '../../user/helpers/content-limit.helper'
import { PaginatedResult } from '../../../shared/interfaces/response/response.interface'
import { IndexedGame } from '../interfaces/index.interface'
import { SearchEngine, SearchQuery } from '../interfaces/search.interface'

export class HikarinagiSearchEngine implements SearchEngine {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hikarinagi: HikarinagiClient,
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
  ): Promise<{ ids: number[]; meta: { total_items: number; total_pages: number } }> {
    const q = query.q?.trim()
    const tag = query.tag?.trim()
    if (!q && !tag) return { ids: [], meta: { total_items: 0, total_pages: 0 } }
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

    return {
      ids: matched.slice((page - 1) * pageSize, page * pageSize),
      meta: {
        total_items: matched.length,
        total_pages: Math.ceil(matched.length / pageSize),
      },
    }
  }

  async searchGames(
    query: SearchQuery,
    content_limit?: UserContentLimit,
  ): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 10
    const result = await this.resolveIds(query, page, pageSize, content_limit)

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
