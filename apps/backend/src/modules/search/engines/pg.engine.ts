import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../prisma.service'
import type { SearchEngine, SearchQuery } from '../interfaces/search.interface'
import { UserContentLimit } from '../../user/interfaces/user.interface'
import { PaginatedResult } from '../../../shared/interfaces/response/response.interface'
import { GameItemResDto } from '../dto/res/game-item.res.dto'
import { CacheService } from '../../cache/services/cache.service'
import { IndexedGame } from '../interfaces/index.interface'

export class PgSearchEngine implements SearchEngine {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async upsertGame(doc: IndexedGame) {
    await this.cacheService.delByContains(`game:${doc.id}`)
  }

  async bulkUpsertGames() {}

  async deleteGame() {}

  async deleteAllGames() {}

  async searchGames(q: SearchQuery): Promise<PaginatedResult<GameItemResDto>> {
    const { page, pageSize, content_limit } = q
    if (!q.q) {
      return {
        items: [],
        meta: {
          totalItems: 0,
          itemCount: 0,
          itemsPerPage: pageSize,
          totalPages: 0,
          currentPage: page,
        },
      }
    }

    const where: Prisma.GameWhereInput = {}
    if (content_limit === UserContentLimit.NEVER_SHOW_NSFW_CONTENT || !content_limit) {
      where.nsfw = { not: true }
      where.covers = { every: { sexual: { in: [0] } } }
    }

    if (q.q) {
      where.OR = [
        { title_jp: { contains: q.q, mode: 'insensitive' } },
        { title_zh: { contains: q.q, mode: 'insensitive' } },
        { title_en: { contains: q.q, mode: 'insensitive' } },
        { aliases: { has: q.q } },
        { intro_jp: { contains: q.q, mode: 'insensitive' } },
        { intro_zh: { contains: q.q, mode: 'insensitive' } },
        { intro_en: { contains: q.q, mode: 'insensitive' } },
        { tags: { has: q.q } },
        {
          developers: {
            some: {
              developer: { name: { contains: q.q, mode: 'insensitive' }, aliases: { has: q.q } },
            },
          },
        },
        {
          characters: {
            some: {
              character: {
                name_jp: { contains: q.q, mode: 'insensitive' },
                name_en: { contains: q.q, mode: 'insensitive' },
                name_zh: { contains: q.q, mode: 'insensitive' },
                aliases: { has: q.q },
                intro_jp: { contains: q.q, mode: 'insensitive' },
                intro_en: { contains: q.q, mode: 'insensitive' },
                intro_zh: { contains: q.q, mode: 'insensitive' },
              },
            },
          },
        },
        { staffs: { array_contains: q.q } },
      ]
    }

    const [total, items] = await Promise.all([
      this.prisma.game.count({ where }),
      this.prisma.game.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ release_date: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
        select: {
          id: true,
          title_jp: true,
          title_zh: true,
          title_en: true,
          aliases: true,
          covers: {
            select: {
              id: true,
              sexual: true,
              violence: true,
              url: true,
              dims: true,
            },
          },
          developers: {
            select: {
              developer: {
                select: {
                  id: true,
                  name: true,
                  aliases: true,
                },
              },
            },
          },
          release_date: true,
        },
      }),
    ])
    return {
      items: items as unknown as GameItemResDto[],
      meta: {
        totalItems: total,
        itemCount: items.length,
        itemsPerPage: pageSize,
        totalPages: Math.ceil(total / pageSize),
        currentPage: page,
      },
    }
  }

  async searchGameTags(): Promise<string[]> {
    return []
  }
}
