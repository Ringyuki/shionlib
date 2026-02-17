import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { CacheService } from '../../cache/services/cache.service'
import { SearchEngine, SEARCH_ENGINE } from '../../search/interfaces/search.interface'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { Prisma } from '@prisma/client'
import { formatDoc, rawDataQuery } from '../../search/helpers/format-doc'
import { GameData } from '../../game/interfaces/game.interface'
import {
  RECENT_UPDATE_KEY,
  RECENT_UPDATE_TTL_MS,
} from '../../game/constants/recent-update.constant'
import { ADMIN_EDITABLE_GAME_SCALAR_FIELDS } from '../constants/game'

@Injectable()
export class AdminGameService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    @Inject(SEARCH_ENGINE) private readonly searchEngine: SearchEngine,
  ) {}

  async getScalar(gameId: number) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      select: ADMIN_EDITABLE_GAME_SCALAR_FIELDS.reduce(
        (acc, field) => ({ ...acc, [field]: true }),
        {} as Prisma.GameSelect,
      ),
    })
    if (!game) {
      throw new ShionBizException(ShionBizCode.GAME_NOT_FOUND)
    }
    return game
  }

  async updateStatus(gameId: number, status: number): Promise<void> {
    await this.prisma.game.update({
      where: { id: gameId },
      data: { status },
    })
    await this.invalidateGameCaches(gameId)
  }

  async editScalar(gameId: number, payload: Record<string, any>): Promise<void> {
    const exist = await this.prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true },
    })
    if (!exist) {
      throw new ShionBizException(ShionBizCode.GAME_NOT_FOUND)
    }

    const data: Prisma.GameUpdateInput = {}
    for (const key of ADMIN_EDITABLE_GAME_SCALAR_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(payload, key)) {
        continue
      }
      const value = payload[key]
      if (value === undefined) {
        continue
      }

      switch (key) {
        case 'b_id':
        case 'v_id':
        case 'type': {
          ;(data as any)[key] =
            typeof value === 'string' && value.trim().length === 0 ? null : value
          break
        }
        case 'release_date': {
          ;(data as any)[key] = value ? value : null
          break
        }
        case 'extra_info':
        case 'staffs': {
          ;(data as any)[key] = value ?? []
          break
        }
        default: {
          ;(data as any)[key] = value
        }
      }
    }

    if (Object.keys(data).length === 0) {
      return
    }

    try {
      await this.prisma.game.update({
        where: { id: gameId },
        data,
      })
    } catch (error) {
      this.rethrowDatabaseErrorAsBiz(error)
    }

    const updated = await this.prisma.game.findUnique({
      where: { id: gameId },
      select: rawDataQuery,
    })
    if (updated) {
      await this.searchEngine.upsertGame(formatDoc(updated as unknown as GameData))
    }

    await this.invalidateGameCaches(gameId)
  }

  async deleteById(gameId: number): Promise<void> {
    const exist = await this.prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true },
    })
    if (!exist) {
      throw new ShionBizException(ShionBizCode.GAME_NOT_FOUND)
    }

    await this.prisma.game.delete({
      where: { id: gameId },
    })
    await this.searchEngine.deleteGame(gameId)
    await this.cacheService.zrem(RECENT_UPDATE_KEY, gameId)
    await this.invalidateGameCaches(gameId)
  }

  async addToRecentUpdate(gameId: number): Promise<void> {
    const now = Date.now()
    await this.cacheService.zadd(RECENT_UPDATE_KEY, now, gameId)
    const expiredBefore = now - RECENT_UPDATE_TTL_MS
    await this.cacheService.zremrangebyscore(RECENT_UPDATE_KEY, '-inf', expiredBefore)
    await this.cacheService.delByContains('game:recent-update:')
  }

  async removeFromRecentUpdate(gameId: number): Promise<void> {
    await this.cacheService.zrem(RECENT_UPDATE_KEY, gameId)
    await this.cacheService.delByContains('game:recent-update:')
  }

  private async invalidateGameCaches(gameId: number) {
    await Promise.all([
      this.cacheService.delByContains(`game:${gameId}`),
      this.cacheService.delByContains('game:list:'),
      this.cacheService.delByContains('game:recent-update:'),
    ])
  }

  private rethrowDatabaseErrorAsBiz(error: unknown): never {
    if (error instanceof ShionBizException) {
      throw error
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        throw new ShionBizException(ShionBizCode.GAME_NOT_FOUND)
      }
      if (error.code === 'P2002') {
        throw new ShionBizException(ShionBizCode.GAME_ALREADY_EXISTS)
      }
      throw new ShionBizException(
        ShionBizCode.COMMON_VALIDATION_FAILED,
        'shion-biz.COMMON_VALIDATION_FAILED',
        {
          prismaCode: error.code,
          message: error.message,
        },
      )
    }

    if (
      error instanceof Prisma.PrismaClientUnknownRequestError ||
      error instanceof Prisma.PrismaClientValidationError ||
      error instanceof Prisma.PrismaClientInitializationError ||
      error instanceof Prisma.PrismaClientRustPanicError
    ) {
      throw new ShionBizException(
        ShionBizCode.COMMON_VALIDATION_FAILED,
        'shion-biz.COMMON_VALIDATION_FAILED',
        {
          message: error.message,
        },
      )
    }

    throw new ShionBizException(
      ShionBizCode.COMMON_VALIDATION_FAILED,
      'shion-biz.COMMON_VALIDATION_FAILED',
      {
        message: error instanceof Error ? error.message : 'Unknown database error',
      },
    )
  }
}
