import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { CreateFavoriteReqDto } from '../dto/req/create-favorite.req.dto'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { CreateFavoriteItemReqDto } from '../dto/req/create-favorite-item.req.dto'
import { UpdateFavoriteItemReqDto } from '../dto/req/update-favorite-item.req.dto'
import { UpdateFavoriteReqDto } from '../dto/req/update-favorite.req.dto'
import { GetFavoriteItemsReqDto } from '../dto/req/get-favorite-items.req.dto'
import { PaginatedResult } from '../../../shared/interfaces/response/response.interface'
import { GetFavoritesReqDto } from '../dto/req/get-favorites.req.dto'
import { Prisma } from '@prisma/client'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'

@Injectable()
export class FavoriteService {
  constructor(private readonly prisma: PrismaService) {}

  async createFavorite(createFavoriteReqDto: CreateFavoriteReqDto, user_id: number) {
    const { name, description, is_private } = createFavoriteReqDto
    const exist = await this.prisma.favorite.findFirst({
      where: {
        user_id,
        name,
      },
    })
    if (exist) {
      throw new ShionBizException(
        ShionBizCode.FAVORITE_ALREADY_EXISTS,
        'shion-biz.FAVORITE_ALREADY_EXISTS',
      )
    }
    return await this.prisma.favorite.create({
      data: {
        user_id,
        name,
        description,
        is_private,
      },
      select: {
        id: true,
        name: true,
        description: true,
        is_private: true,
      },
    })
  }

  async deleteFavorite(favorite_id: number, user_id: number) {
    const exist = await this.prisma.favorite.findUnique({
      where: {
        id: favorite_id,
      },
    })
    if (!exist) {
      throw new ShionBizException(ShionBizCode.FAVORITE_NOT_FOUND, 'shion-biz.FAVORITE_NOT_FOUND')
    }
    if (exist.user_id !== user_id) {
      throw new ShionBizException(ShionBizCode.FAVORITE_NOT_OWNER, 'shion-biz.FAVORITE_NOT_OWNER')
    }
    if (exist.default) {
      throw new ShionBizException(
        ShionBizCode.FAVORITE_DEFAULT_NOT_ALLOW_DELETE,
        'shion-biz.FAVORITE_DEFAULT_NOT_ALLOW_DELETE',
      )
    }

    await this.prisma.favorite.delete({
      where: {
        id: favorite_id,
      },
    })
  }

  async updateFavorite(
    favorite_id: number,
    user_id: number,
    updateFavoriteReqDto: UpdateFavoriteReqDto,
  ) {
    const { name, description, is_private } = updateFavoriteReqDto
    const exist = await this.prisma.favorite.findUnique({
      where: {
        id: favorite_id,
      },
      select: {
        user_id: true,
      },
    })
    if (!exist) {
      throw new ShionBizException(ShionBizCode.FAVORITE_NOT_FOUND, 'shion-biz.FAVORITE_NOT_FOUND')
    }
    if (exist.user_id !== user_id) {
      throw new ShionBizException(ShionBizCode.FAVORITE_NOT_OWNER, 'shion-biz.FAVORITE_NOT_OWNER')
    }

    const isNameExisted = await this.prisma.favorite.findFirst({
      where: {
        user_id,
        name,
      },
    })
    if (isNameExisted && isNameExisted.id !== favorite_id) {
      throw new ShionBizException(
        ShionBizCode.FAVORITE_NAME_ALREADY_EXISTS,
        'shion-biz.FAVORITE_NAME_ALREADY_EXISTS',
      )
    }

    await this.prisma.favorite.update({
      where: {
        id: favorite_id,
      },
      data: {
        name,
        description,
        is_private,
      },
    })
  }

  async addGameToFavorite(
    favorite_id: number,
    user_id: number,
    createFavoriteItemReqDto: CreateFavoriteItemReqDto,
  ) {
    const exist = await this.prisma.favorite.findUnique({
      where: {
        id: favorite_id,
      },
      select: {
        user_id: true,
      },
    })
    if (!exist) {
      throw new ShionBizException(ShionBizCode.FAVORITE_NOT_FOUND, 'shion-biz.FAVORITE_NOT_FOUND')
    }
    if (exist.user_id !== user_id) {
      throw new ShionBizException(ShionBizCode.FAVORITE_NOT_OWNER, 'shion-biz.FAVORITE_NOT_OWNER')
    }

    const { game_id, note } = createFavoriteItemReqDto
    const existGame = await this.prisma.game.findUnique({
      where: {
        id: game_id,
      },
    })
    if (!existGame) {
      throw new ShionBizException(ShionBizCode.GAME_NOT_FOUND, 'shion-biz.GAME_NOT_FOUND')
    }

    const existItem = await this.prisma.favoriteItem.findFirst({
      where: {
        favorite_id,
        game_id,
      },
      select: {
        favorite: {
          select: {
            user_id: true,
          },
        },
      },
    })
    if (existItem) {
      throw new ShionBizException(
        ShionBizCode.FAVORITE_ITEM_ALREADY_EXISTS,
        'shion-biz.FAVORITE_ITEM_ALREADY_EXISTS',
      )
    }
    await this.prisma.favoriteItem.create({
      data: {
        favorite_id,
        game_id,
        note,
      },
    })
  }

  async deleteFavoriteItemByGameId(favorite_id: number, game_id: number, user_id: number) {
    const exist = await this.prisma.favoriteItem.findFirst({
      where: {
        favorite_id,
        game_id,
      },
    })
    if (!exist) {
      throw new ShionBizException(
        ShionBizCode.FAVORITE_ITEM_NOT_FOUND,
        'shion-biz.FAVORITE_ITEM_NOT_FOUND',
      )
    }
    await this.deleteFavoriteItem(exist.id, user_id)
  }

  async deleteFavoriteItem(favorite_item_id: number, user_id: number) {
    const exist = await this.prisma.favoriteItem.findFirst({
      where: {
        id: favorite_item_id,
      },
      select: {
        favorite: {
          select: {
            user_id: true,
          },
        },
      },
    })
    if (!exist) {
      throw new ShionBizException(
        ShionBizCode.FAVORITE_ITEM_NOT_FOUND,
        'shion-biz.FAVORITE_ITEM_NOT_FOUND',
      )
    }
    if (exist.favorite.user_id !== user_id) {
      throw new ShionBizException(
        ShionBizCode.FAVORITE_ITEM_NOT_OWNER,
        'shion-biz.FAVORITE_ITEM_NOT_OWNER',
      )
    }
    await this.prisma.favoriteItem.delete({
      where: {
        id: favorite_item_id,
      },
    })
  }

  async updateFavoriteItem(
    favorite_item_id: number,
    user_id: number,
    updateFavoriteItemReqDto: UpdateFavoriteItemReqDto,
  ) {
    const { note } = updateFavoriteItemReqDto
    const exist = await this.prisma.favoriteItem.findUnique({
      where: {
        id: favorite_item_id,
      },
      select: {
        favorite: {
          select: {
            user_id: true,
          },
        },
      },
    })
    if (!exist) {
      throw new ShionBizException(
        ShionBizCode.FAVORITE_ITEM_NOT_FOUND,
        'shion-biz.FAVORITE_ITEM_NOT_FOUND',
      )
    }
    if (exist.favorite.user_id !== user_id) {
      throw new ShionBizException(
        ShionBizCode.FAVORITE_ITEM_NOT_OWNER,
        'shion-biz.FAVORITE_ITEM_NOT_OWNER',
      )
    }

    await this.prisma.favoriteItem.update({
      where: {
        id: favorite_item_id,
      },
      data: {
        note,
      },
    })
  }

  async getFavorites(user_id: number, dto: GetFavoritesReqDto) {
    const { game_id, user_id: user_id_param } = dto

    if (!user_id && game_id) {
      throw new ShionBizException(ShionBizCode.AUTH_UNAUTHORIZED, 'shion-biz.AUTH_UNAUTHORIZED')
    }

    const where: Prisma.FavoriteWhereInput = {}
    if (user_id_param) {
      where.user_id = user_id_param
      if (user_id_param !== user_id) {
        where.is_private = false
      }
    } else if (user_id) {
      where.user_id = user_id
    }

    const favorites = await this.prisma.favorite.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        is_private: true,
        default: true,
      },
    })
    const favoriteIds = favorites.map(favorite => favorite.id)
    if (favoriteIds.length === 0) return []

    const counts = await this.prisma.favoriteItem.groupBy({
      by: ['favorite_id'],
      where: {
        favorite_id: { in: favoriteIds },
      },
      _count: {
        favorite_id: true,
      },
    })
    const countMap = new Map(counts.map(item => [item.favorite_id, item._count.favorite_id]))

    if (!game_id) {
      return favorites.map(favorite => ({
        ...favorite,
        game_count: countMap.get(favorite.id) ?? 0,
      }))
    }

    const favoriteItems = await this.prisma.favoriteItem.findMany({
      where: {
        favorite_id: { in: favoriteIds },
        game_id,
      },
      select: {
        favorite_id: true,
      },
    })
    const favoriteIdSet = new Set(favoriteItems.map(item => item.favorite_id))

    return favorites.map(favorite => ({
      ...favorite,
      game_count: countMap.get(favorite.id) ?? 0,
      is_favorite: favoriteIdSet.has(favorite.id),
    }))
  }

  async getFavoriteItems(
    favorite_id: number,
    dto: GetFavoriteItemsReqDto,
    req: RequestWithUser,
  ): Promise<PaginatedResult<any>> {
    const { page, pageSize } = dto

    const exist = await this.prisma.favorite.findUnique({
      where: {
        id: favorite_id,
      },
      select: {
        user_id: true,
        is_private: true,
      },
    })
    if (!exist) {
      throw new ShionBizException(ShionBizCode.FAVORITE_NOT_FOUND, 'shion-biz.FAVORITE_NOT_FOUND')
    }
    if (exist.user_id !== req.user?.sub && exist.is_private) {
      throw new ShionBizException(
        ShionBizCode.FAVORITE_NOT_ALLOW_VIEW,
        'shion-biz.FAVORITE_NOT_ALLOW_VIEW',
      )
    }

    const total = await this.prisma.favoriteItem.count({
      where: {
        favorite_id,
      },
    })
    const favorite = await this.prisma.favoriteItem.findMany({
      where: {
        favorite_id,
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: {
        created: 'desc',
      },
      select: {
        id: true,
        note: true,
        game: {
          select: {
            id: true,
            title_jp: true,
            title_zh: true,
            title_en: true,
            platform: true,
            type: true,
            tags: true,
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
            covers: {
              select: {
                url: true,
                language: true,
                dims: true,
                sexual: true,
                violence: true,
              },
            },
            release_date: true,
          },
        },
      },
    })

    return {
      items: favorite,
      meta: {
        totalItems: total,
        itemCount: favorite.length,
        itemsPerPage: pageSize,
        totalPages: Math.ceil(total / pageSize),
        currentPage: page,
        content_limit: req.user.content_limit,
      },
    }
  }

  async getFavoriteStats(user_id: number, game_id: number) {
    const favorite = await this.prisma.favoriteItem.findFirst({
      where: {
        game_id,
        favorite: {
          user_id,
        },
      },
    })
    return {
      is_favorite: !!favorite,
    }
  }
}
