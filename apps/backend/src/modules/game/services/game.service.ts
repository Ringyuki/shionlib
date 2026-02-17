import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { PaginatedResult } from '../../../shared/interfaces/response/response.interface'
import { GetGameListResDto } from '../dto/res/get-game-list.res.dto'
import { GetGameResDto } from '../dto/res/get-game.res.dto'
import { Prisma } from '@prisma/client'
import { PaginationReqDto } from '../../../shared/dto/req/pagination.req.dto'
import { UserContentLimit } from '../../user/interfaces/user.interface'
import { GetGameListFilterReqDto } from '../dto/req/get-game-list.req.dto'
import { applyDate } from '../helpers/date-filters'
import { CacheService } from '../../cache/services/cache.service'
import { RECENT_UPDATE_KEY, RECENT_UPDATE_TTL_MS } from '../constants/recent-update.constant'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'

@Injectable()
export class GameService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}
  async getById(id: number, content_limit?: number): Promise<GetGameResDto> {
    await this.handleNotFoundAndContentLimit(id, content_limit)

    const select: Prisma.GameSelect = {
      title_jp: true,
      title_zh: true,
      title_en: true,
      intro_jp: true,
      intro_zh: true,
      intro_en: true,
      covers: {
        select: {
          language: true,
          type: true,
          url: true,
          dims: true,
          sexual: true,
          violence: true,
        },
      },
      developers: {
        select: {
          role: true,
          developer: {
            select: {
              id: true,
              name: true,
              aliases: true,
            },
          },
        },
      },
      characters: {
        select: {
          role: true,
          image: true,
          actor: true,
          character: {
            select: {
              id: true,
              image: true,
              name_jp: true,
              name_zh: true,
              name_en: true,
              aliases: true,
              intro_jp: true,
              intro_zh: true,
              intro_en: true,
              gender: true,
              blood_type: true,
              height: true,
              weight: true,
              bust: true,
              waist: true,
              hips: true,
              cup: true,
              age: true,
              birthday: true,
            },
          },
        },
      },
    }
    if (content_limit !== UserContentLimit.NEVER_SHOW_NSFW_CONTENT) {
      select.images = {
        select: {
          url: true,
          dims: true,
          sexual: true,
          violence: true,
        },
      }
    }

    const game = await this.prisma.game.findUnique({
      where: {
        id,
      },
      select,
    })

    const data = {
      ...game,
      content_limit,
    } as unknown as GetGameResDto

    return data
  }

  async getHeader(id: number, content_limit?: number) {
    await this.handleNotFoundAndContentLimit(id, content_limit)

    const select: Prisma.GameSelect = {
      v_id: true,
      id: true,
      title_jp: true,
      title_zh: true,
      title_en: true,
      aliases: true,
      covers: {
        select: {
          language: true,
          type: true,
          url: true,
          dims: true,
          sexual: true,
          violence: true,
        },
      },
      developers: {
        select: {
          role: true,
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
      release_date_tba: true,
      extra_info: true,
      type: true,
      platform: true,
    }

    const header = await this.prisma.game.findUnique({
      where: { id },
      select,
    })

    return {
      ...header,
      content_limit,
    }
  }

  async getDetails(id: number, content_limit?: number) {
    await this.handleNotFoundAndContentLimit(id, content_limit)

    const select: Prisma.GameSelect = {
      id: true,
      intro_jp: true,
      intro_zh: true,
      intro_en: true,
      images: {
        select: {
          url: true,
          dims: true,
          sexual: true,
          violence: true,
        },
        where: {
          sexual: {
            in: [0],
          },
        },
      },
      extra_info: true,
      tags: true,
      staffs: true,
      nsfw: true,
      link: {
        select: {
          id: true,
          url: true,
          label: true,
          name: true,
        },
      },
    }
    if (content_limit !== UserContentLimit.NEVER_SHOW_NSFW_CONTENT) {
      select.images = {
        select: {
          url: true,
          dims: true,
          sexual: true,
          violence: true,
        },
      }
    }
    const game = await this.prisma.game.findUnique({
      where: {
        id,
      },
      select,
    })

    return {
      ...game,
      content_limit,
    }
  }

  async getCharacters(id: number, content_limit?: number) {
    await this.handleNotFoundAndContentLimit(id, content_limit)

    const select: Prisma.GameSelect = {
      characters: {
        select: {
          role: true,
          image: true,
          actor: true,
          character: {
            select: {
              id: true,
              image: true,
              name_jp: true,
              name_zh: true,
              name_en: true,
              aliases: true,
              intro_jp: true,
              intro_zh: true,
              intro_en: true,
              gender: true,
              blood_type: true,
              height: true,
              weight: true,
              bust: true,
              waist: true,
              hips: true,
              cup: true,
              age: true,
              birthday: true,
            },
          },
        },
      },
    }

    const characters = await this.prisma.game.findUnique({
      where: {
        id,
      },
      select,
    })

    return characters
  }

  async getList(
    getGameListReqDto: PaginationReqDto,
    content_limit?: number,
    producer_id?: number,
    character_id?: number,
    filter?: GetGameListFilterReqDto,
  ): Promise<PaginatedResult<GetGameListResDto>> {
    const { page = 1, pageSize = 10 } = getGameListReqDto
    const { tags, years, months, sort_by, sort_order, start_date, end_date } = filter ?? {}

    let where: Prisma.GameWhereInput = {
      status: 1,
    }
    if (content_limit === UserContentLimit.NEVER_SHOW_NSFW_CONTENT || !content_limit) {
      where.nsfw = {
        not: true,
      }
      where.covers = {
        every: {
          sexual: {
            in: [0],
          },
        },
      }
    }
    if (producer_id)
      where.developers = {
        some: {
          developer: {
            id: producer_id,
          },
        },
      }
    if (character_id)
      where.characters = {
        some: {
          character: {
            id: character_id,
          },
        },
      }

    if (tags)
      where.tags = {
        hasSome: tags,
      }

    if (start_date && end_date) {
      const [from, to] = start_date <= end_date ? [start_date, end_date] : [end_date, start_date]
      where.release_date = {
        gte: new Date(from),
        lte: new Date(to),
      }
    } else if (years || months) where = applyDate(where, { years, months })
    if (start_date || end_date || years || months) {
      where.release_date_tba = {
        not: true,
      }
    }

    const orderByArray: Prisma.GameOrderByWithRelationInput[] = []
    orderByArray.push({ release_date_tba: 'asc' })
    if (sort_by) {
      orderByArray.push({ [sort_by]: sort_order } as Prisma.GameOrderByWithRelationInput)
    } else {
      orderByArray.push({ release_date: 'desc' })
    }
    orderByArray.push({ id: 'desc' })

    const total = await this.prisma.game.count({
      where,
    })
    const games = await this.prisma.game.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: orderByArray,
      where,
      select: {
        id: true,
        title_jp: true,
        title_zh: true,
        title_en: true,
        aliases: true,
        type: true,
        covers: {
          select: {
            language: true,
            type: true,
            dims: true,
            sexual: true,
            violence: true,
            url: true,
          },
        },
        views: true,
      },
    })

    return {
      items: games,
      meta: {
        totalItems: total,
        itemCount: games.length,
        itemsPerPage: pageSize,
        totalPages: Math.ceil(total / pageSize),
        currentPage: page,
        content_limit,
      },
    }
  }

  async getRecentUpdate(
    dto: PaginationReqDto,
    content_limit?: number,
  ): Promise<PaginatedResult<GetGameListResDto>> {
    const { page = 1, pageSize = 100 } = dto
    const start = (page - 1) * pageSize
    const end = start + pageSize - 1
    const now = Date.now()
    const expiredBefore = now - RECENT_UPDATE_TTL_MS
    await this.cacheService.zremrangebyscore(RECENT_UPDATE_KEY, '-inf', expiredBefore)

    const [items, total] = await Promise.all([
      this.cacheService.zrangeWithScores(RECENT_UPDATE_KEY, start, end, 'DESC'),
      this.cacheService.zcard(RECENT_UPDATE_KEY),
    ])
    const gameIds = items.map(item => Number(item.member))

    const where: Prisma.GameWhereInput = {
      id: { in: gameIds },
      status: 1,
    }
    if (content_limit === UserContentLimit.NEVER_SHOW_NSFW_CONTENT || !content_limit) {
      where.nsfw = {
        not: true,
      }
      where.covers = {
        every: {
          sexual: {
            in: [0],
          },
        },
      }
    }
    const games = await this.prisma.game.findMany({
      where,
      select: {
        id: true,
        title_jp: true,
        title_zh: true,
        title_en: true,
        aliases: true,
        type: true,
        covers: {
          select: {
            language: true,
            type: true,
            dims: true,
            sexual: true,
            violence: true,
            url: true,
          },
        },
        views: true,
      },
    })
    const gameMap = new Map(games.map(game => [game.id, game]))
    const sortedGames = gameIds.map(id => gameMap.get(id)).filter(Boolean) as typeof games

    return {
      items: sortedGames,
      meta: {
        totalItems: total,
        itemCount: sortedGames.length,
        itemsPerPage: pageSize,
        totalPages: Math.ceil(total / pageSize),
        currentPage: page,
      },
    }
  }

  async increaseViews(game_id: number) {
    await this.prisma.game.update({
      where: { id: game_id },
      data: { views: { increment: 1 } },
      select: {
        views: true,
      },
    })
  }

  async getRandomGameId(req: RequestWithUser): Promise<number | null> {
    const n = await this.prisma.game.count({
      where: { status: 1 },
    })
    if (n === 0) return null
    const k = Math.floor(Math.random() * n)

    const item = await this.prisma.game.findFirst({
      where: { status: 1 },
      select: { id: true, nsfw: true, covers: { select: { sexual: true } } },
      orderBy: { id: 'asc' },
      skip: k,
    })
    if (!item) return null
    if (
      (item.nsfw || item.covers.some(c => c.sexual > 0)) &&
      (req.user.content_limit === UserContentLimit.NEVER_SHOW_NSFW_CONTENT ||
        !req.user.content_limit)
    ) {
      return null
    }
    return item.id
  }

  private async handleNotFoundAndContentLimit(id: number, content_limit?: number): Promise<void> {
    const exist = await this.prisma.game.findUnique({
      where: {
        id,
        status: 1,
      },
      select: {
        views: true,
        nsfw: true,
        covers: {
          select: {
            sexual: true,
          },
        },
      },
    })
    if (!exist) {
      throw new ShionBizException(ShionBizCode.GAME_NOT_FOUND)
    }
    if (
      (exist.nsfw || exist.covers.some(c => c.sexual > 0)) &&
      (content_limit === UserContentLimit.NEVER_SHOW_NSFW_CONTENT || !content_limit)
    ) {
      throw new ShionBizException(ShionBizCode.GAME_NOT_FOUND)
    }
  }
}
