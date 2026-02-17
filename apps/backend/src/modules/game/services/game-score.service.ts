import { Injectable } from '@nestjs/common'
import { CacheService } from '../../cache/services/cache.service'
import { PrismaService } from '../../../prisma.service'
import { BangumiAuthService } from '../../bangumi/services/bangumi-auth.service'
import { BangumiGameItemRes } from '../interfaces/bangumi/game-item.res.interface'
import { VNDBService } from '../../vndb/services/vndb.service'
import { VNDBGameItemRating } from '../interfaces/vndb/game-item.res'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'

@Injectable()
export class GameScoreService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly prisma: PrismaService,
    private readonly bangumiService: BangumiAuthService,
    private readonly vndbService: VNDBService,
  ) {}

  async getBangumiScore(id: number) {
    const game = await this.prisma.game.findUnique({
      where: {
        id,
      },
      select: {
        b_id: true,
      },
    })
    if (!game) {
      throw new ShionBizException(ShionBizCode.GAME_NOT_FOUND)
    }
    if (!game.b_id) {
      return null
    }

    const cacheKey = `game:score:bangumi:${game.b_id}`
    const cachedScore = await this.cacheService.get<{
      rating: BangumiGameItemRes['rating']
      id: number
    }>(cacheKey)
    if (cachedScore) {
      return cachedScore
    }

    const { rating, id: b_id } = await this.bangumiService.bangumiRequest<BangumiGameItemRes>(
      `https://api.bgm.tv/v0/subjects/${game.b_id}`,
    )
    await this.cacheService.set(cacheKey, { rating, id: b_id }, 60 * 60 * 24 * 7 * 1000) // 7 days

    return { rating, id: b_id }
  }

  async getVNDBScore(id: number) {
    const game = await this.prisma.game.findUnique({
      where: {
        id,
      },
      select: {
        v_id: true,
      },
    })
    if (!game) {
      throw new ShionBizException(ShionBizCode.GAME_NOT_FOUND)
    }
    if (!game.v_id) {
      return null
    }

    const cacheKey = `game:score:vndb:${game.v_id}`
    const cachedScore = await this.cacheService.get<VNDBGameItemRating>(cacheKey)
    if (cachedScore) {
      return cachedScore
    }

    const data = await this.vndbService.vndbRequest<VNDBGameItemRating>(
      'single',
      ['id', '=', game.v_id],
      ['rating', 'average', 'votecount'],
      'vn',
    )
    await this.cacheService.set(cacheKey, data, 60 * 60 * 24 * 7 * 1000) // 7 days

    return data
  }
}
