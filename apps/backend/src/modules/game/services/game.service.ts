import { forwardRef, Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { PaginatedResult } from '../../../shared/interfaces/response/response.interface'
import { GetGameListResDto } from '../dto/res/get-game-list.res.dto'
import { GetGameListReqDto } from '../dto/req/get-game-list.req.dto'
import { GetGameResDto } from '../dto/res/get-game.res.dto'
import { Prisma } from '@prisma/client'
import { PaginationReqDto } from '../../../shared/dto/req/pagination.req.dto'
import { releasePeriods } from '../helpers/date-filters'
import { HikarinagiClient } from '../../hikarinagi/clients/hikarinagi.client'
import {
  mapBundleToCharacters,
  mapBundleToDetails,
  mapBundleToGameDetail,
  hasRatedMedia,
  mapBundleToHeader,
  mapBundleToLinks,
  mapBundleToRelations,
  mapBundleToTags,
  emptyNestedGame,
  mapCardToListItem,
} from '../../hikarinagi/mappers/galgame-read.mapper'
import { InternalGalgameBundle } from '../../hikarinagi/interfaces/galgame-mapping.interface'
import { galgameBundleKey } from '../../hikarinagi/constants/cache-keys.constant'
import { includesRated } from '../../user/helpers/content-limit.helper'
import { CacheService } from '../../cache/services/cache.service'
import { RECENT_UPDATE_KEY, RECENT_UPDATE_TTL_MS } from '../constants/recent-update.constant'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { HikarinagiMappingService } from '../../hikarinagi/services/hikarinagi-mapping.service'

const GAME_DETAIL_CACHE_TTL_MS = 6 * 60 * 60 * 1000

@Injectable()
export class GameService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly hikarinagiMappingService: HikarinagiMappingService,
    @Inject(forwardRef(() => HikarinagiClient))
    private readonly hikarinagi: HikarinagiClient,
  ) {}
  private async hikarinagiBundle(hikarinagiId: number): Promise<InternalGalgameBundle> {
    const cacheKey = galgameBundleKey(hikarinagiId)
    const cached = await this.cacheService.get<InternalGalgameBundle | null>(cacheKey)
    if (cached) return cached

    const bundle = await this.hikarinagi.galgameDetail(hikarinagiId)
    if (!bundle) throw new ShionBizException(ShionBizCode.GAME_NOT_FOUND)
    await this.cacheService.set(cacheKey, bundle, GAME_DETAIL_CACHE_TTL_MS)

    return bundle
  }

  private async localShell(id: number) {
    const local = await this.prisma.game.findUnique({
      where: { id, status: 1 },
      select: {
        id: true,
        v_id: true,
        b_id: true,
        h_id: true,
        extra_info: true,
      },
    })
    if (!local) throw new ShionBizException(ShionBizCode.GAME_NOT_FOUND)

    const h_id = await this.resolveHikarinagiId(id, local)
    if (h_id == null) throw new ShionBizException(ShionBizCode.GAME_NOT_FOUND)

    return { ...local, h_id }
  }

  async getById(id: number, content_limit?: number): Promise<GetGameResDto> {
    const { bundle } = await this.readThrough(id, content_limit)

    return {
      ...mapBundleToGameDetail(bundle, includesRated(content_limit)),
      tags: mapBundleToTags(bundle),
      content_limit,
    } as unknown as GetGameResDto
  }

  private async relationsOf(bundle: InternalGalgameBundle, includeRated: boolean) {
    const targetIds = (bundle.relations ?? []).map(row => row.target_galgame.id)
    const shells = targetIds.length
      ? await this.prisma.game.findMany({
          where: { h_id: { in: targetIds }, status: 1 },
          select: { id: true, h_id: true },
        })
      : []
    const localIdByRemoteId = new Map(
      shells.flatMap(shell => (shell.h_id == null ? [] : [[shell.h_id, shell.id] as const])),
    )

    return {
      link: mapBundleToLinks(bundle),
      relations_from: mapBundleToRelations(bundle, localIdByRemoteId, includeRated),
    }
  }

  async getHeader(id: number, content_limit?: number) {
    const { local, bundle } = await this.readThrough(id, content_limit)

    return {
      id: local.id,
      v_id: local.v_id,
      b_id: local.b_id,
      h_id: local.h_id,
      extra_info: local.extra_info,
      ...mapBundleToHeader(bundle, includesRated(content_limit)),
      content_limit,
    }
  }

  private async resolveHikarinagiId(
    id: number,
    game: { h_id?: number | null; b_id?: string | null } | null,
  ) {
    if (!game) return null
    if (game.h_id != null || !game.b_id) return game.h_id ?? null

    return await this.hikarinagiMappingService.resolveByBangumiId(id, game.b_id)
  }

  async getDetails(id: number, content_limit?: number) {
    const { local, bundle } = await this.readThrough(id, content_limit)
    const relations = await this.relationsOf(bundle, includesRated(content_limit))

    return {
      id: local.id,
      extra_info: local.extra_info,
      tags: mapBundleToTags(bundle),
      ...mapBundleToDetails(bundle, includesRated(content_limit)),
      ...relations,
      content_limit,
    }
  }

  async getCharacters(id: number, content_limit?: number) {
    const { bundle } = await this.readThrough(id, content_limit)

    return { characters: mapBundleToCharacters(bundle), content_limit }
  }

  private async mergeCards(
    shells: { id: number; h_id: number | null; views: number }[],
    includeRated: boolean,
  ) {
    const ids = shells.map(shell => shell.h_id).filter((id): id is number => id != null)
    const cards = ids.length ? await this.hikarinagi.galgameBatch(ids) : []
    const byId = new Map(cards.map(card => [card.id, card]))

    return shells.map(shell => {
      const card = shell.h_id != null ? byId.get(shell.h_id) : undefined

      return {
        id: shell.id,
        views: shell.views,
        ...emptyNestedGame(),
        ...(card ? mapCardToListItem(card, includeRated) : {}),
      }
    })
  }

  private pageOf(
    items: GetGameListResDto[],
    total: number,
    page: number,
    pageSize: number,
    content_limit?: number,
  ): PaginatedResult<GetGameListResDto> {
    return {
      items,
      meta: {
        totalItems: total,
        itemCount: items.length,
        itemsPerPage: pageSize,
        totalPages: Math.ceil(total / pageSize),
        currentPage: page,
        content_limit,
      },
    }
  }

  async getList(
    getGameListReqDto: GetGameListReqDto,
    content_limit?: number,
  ): Promise<PaginatedResult<GetGameListResDto>> {
    const { page = 1, pageSize = 10, developer_id: producer_id, character_id } = getGameListReqDto
    const {
      tags,
      exclude_tags,
      years,
      months,
      platforms,
      sort_by,
      sort_order,
      start_date,
      end_date,
    } = getGameListReqDto.filter ?? {}

    const orderedByRelease = !sort_by || sort_by === 'release_date'
    const { ids } = await this.hikarinagi.galgameIds({
      producer_id,
      character_id,
      content_limit,
      tags,
      exclude_tags,
      platforms,
      release_periods: releasePeriods({ years, months }),
      released_after: start_date?.toISOString(),
      released_before: end_date?.toISOString(),
      sort_order: orderedByRelease ? sort_order : undefined,
      exclude_rated_covers: !includesRated(content_limit),
    })
    if (!ids.length) return this.pageOf([], 0, page, pageSize, content_limit)

    const where: Prisma.GameWhereInput = { status: 1, h_id: { in: ids } }
    const select = { id: true, h_id: true, views: true }
    const skip = (page - 1) * pageSize

    if (orderedByRelease) {
      const rows = await this.prisma.game.findMany({ where, select })
      const byHikarinagiId = new Map(rows.map(row => [row.h_id, row]))
      const ordered = ids.map(id => byHikarinagiId.get(id)).filter(row => row !== undefined)
      const shells = ordered.slice(skip, skip + pageSize)

      return this.pageOf(
        await this.mergeCards(shells, includesRated(content_limit)),
        ordered.length,
        page,
        pageSize,
        content_limit,
      )
    }

    const [total, shells] = await Promise.all([
      this.prisma.game.count({ where }),
      this.prisma.game.findMany({
        skip,
        take: pageSize,
        orderBy: [{ [sort_by]: sort_order }, { id: 'desc' }],
        where,
        select,
      }),
    ])

    return this.pageOf(
      await this.mergeCards(shells, includesRated(content_limit)),
      total,
      page,
      pageSize,
      content_limit,
    )
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

    const safeIds = await this.hikarinagi.safeGalgameIds(content_limit)
    const where: Prisma.GameWhereInput = {
      id: { in: gameIds },
      status: 1,
      ...(safeIds ? { h_id: { in: safeIds } } : {}),
    }
    const shells = await this.prisma.game.findMany({
      where,
      select: { id: true, h_id: true, views: true },
    })
    const shellMap = new Map(shells.map(shell => [shell.id, shell]))
    const ordered = gameIds.map(id => shellMap.get(id)).filter(Boolean) as typeof shells
    const sortedGames = await this.mergeCards(ordered, includesRated(content_limit))

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
    const safeIds = await this.hikarinagi.safeGalgameIds(req.user?.content_limit)
    const where: Prisma.GameWhereInput = {
      status: 1,
      ...(safeIds ? { h_id: { in: safeIds } } : {}),
    }
    const n = await this.prisma.game.count({ where })
    if (n === 0) return null

    const item = await this.prisma.game.findFirst({
      where,
      select: { id: true },
      orderBy: { id: 'asc' },
      skip: Math.floor(Math.random() * n),
    })

    return item?.id ?? null
  }

  private async readThrough(id: number, content_limit?: number) {
    const local = await this.localShell(id)
    const bundle = await this.hikarinagiBundle(local.h_id)
    if (!includesRated(content_limit) && hasRatedMedia(bundle)) {
      throw new ShionBizException(ShionBizCode.GAME_NOT_FOUND)
    }

    return { local, bundle }
  }
}
