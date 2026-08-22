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

  async searchGames(
    query: SearchQuery,
    content_limit?: UserContentLimit,
  ): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 10
    const result = await this.hikarinagi.searchGalgameIds({
      q: query.q ?? '',
      page,
      page_size: pageSize,
      content_limit,
    })

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
