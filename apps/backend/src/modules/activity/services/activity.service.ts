import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { CreateActivityReqDto } from '../dto/create-activity.dto'
import { PaginatedResult } from '../../../shared/interfaces/response/response.interface'
import { ActivityResDto } from '../dto/res/activity.res.dto'
import { Prisma } from '@prisma/client'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { USER_AVATAR_SELECT, mapUserAvatar } from '../../../shared/constants/user-select.constant'
import { GetActivityListReqDto } from '../dto/req/get-activity-list.req.dto'
import { ActivityListCategoryTypes } from '../constants/activity-list-category.constant'

import { HikarinagiClient } from '../../hikarinagi/clients/hikarinagi.client'
import { emptyNestedGame, mapCardToNestedGame } from '../../hikarinagi/mappers/galgame-read.mapper'
import { includesRated } from '../../user/helpers/content-limit.helper'

@Injectable()
export class ActivityService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly hikarinagi: HikarinagiClient,
  ) {}

  private async hydrateGames<T extends { game: { id: number; h_id: number | null } | null }>(
    rows: T[],
    includeRated: boolean,
  ): Promise<T[]> {
    const ids = [
      ...new Set(rows.map(row => row.game?.h_id).filter((id): id is number => id != null)),
    ]
    if (!ids.length) return rows

    const cards = await this.hikarinagi.galgameBatch(ids)
    const byId = new Map(cards.map(card => [card.id, card]))

    return rows.map(row => {
      if (!row.game) return row
      const card = row.game.h_id != null ? byId.get(row.game.h_id) : undefined

      return {
        ...row,
        game: {
          id: row.game.id,
          ...emptyNestedGame(),
          ...(card ? mapCardToNestedGame(card, includeRated) : {}),
        },
      } as T
    })
  }

  async create(createActivityReqDto: CreateActivityReqDto, tx?: Prisma.TransactionClient) {
    const {
      type,
      user_id,
      comment_id,
      game_id,
      walkthrough_id,
      edit_record_id,
      developer_id,
      character_id,
      file_id,
      file_status,
      file_check_status,
      file_size,
      file_name,
    } = createActivityReqDto

    await (tx || this.prismaService).activity.create({
      data: {
        type,
        user_id,
        game_id,
        walkthrough_id,
        edit_record_id,
        comment_id,
        developer_id,
        character_id,
        file_id,
        file_status,
        file_check_status,
        file_size,
        file_name,
      },
    })
  }

  async getList(
    paginationReqDto: GetActivityListReqDto,
    req: RequestWithUser,
  ): Promise<PaginatedResult<ActivityResDto>> {
    const { page, pageSize, category } = paginationReqDto
    const where: Prisma.ActivityWhereInput = {}
    if (category) {
      where.type = { in: ActivityListCategoryTypes[category] }
    }
    const safeIds = await this.hikarinagi.safeGalgameIds(req.user?.content_limit)
    if (safeIds) where.game = { h_id: { in: safeIds } }
    const total = await this.prismaService.activity.count({
      where,
    })
    const activities = await this.prismaService.activity.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      where,
      orderBy: {
        created: 'desc',
      },
      select: {
        id: true,
        type: true,
        game: { select: { id: true, h_id: true } },
        walkthrough: {
          select: {
            id: true,
            title: true,
          },
        },
        comment: {
          select: {
            id: true,
            html: true,
          },
        },
        developer: {
          select: {
            id: true,
            name: true,
          },
        },
        character: {
          select: {
            id: true,
            name_jp: true,
            name_zh: true,
            name_en: true,
          },
        },
        file: {
          select: {
            id: true,
            file_name: true,
            file_size: true,
          },
        },
        file_status: true,
        file_check_status: true,
        file_size: true,
        file_name: true,
        user: {
          select: USER_AVATAR_SELECT,
        },
        created: true,
        updated: true,
      },
    })

    const hydrated = await this.hydrateGames(activities, includesRated(req.user?.content_limit))

    return {
      items: hydrated.map(a => ({
        id: a.id,
        type: a.type,
        user: mapUserAvatar(a.user),
        game: a.game,
        walkthrough: a.walkthrough,
        comment: a.comment,
        developer: a.developer,
        character: a.character,
        file:
          a.file || a.file_name || a.file_size
            ? {
                id: a.file?.id ?? 0,
                file_name: a.file?.file_name ?? a.file_name ?? '',
                file_size: Number(a.file?.file_size ?? a.file_size ?? 0),
                file_status: a.file_status,
                file_check_status: a.file_check_status,
              }
            : undefined,
        created: a.created,
        updated: a.updated,
      })) as unknown as ActivityResDto[],
      meta: {
        totalItems: total,
        itemCount: activities.length,
        itemsPerPage: pageSize,
        totalPages: Math.ceil(total / pageSize),
        currentPage: page,
        content_limit: req.user.content_limit,
      },
    }
  }
}
