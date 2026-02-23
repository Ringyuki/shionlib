import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { S3Service } from '../../s3/services/s3.service'
import { IMAGE_STORAGE } from '../../s3/constants/s3.constants'
import { PvnGameDataResDto } from '../dto/res/pvn-game-data.res.dto'
import {
  PvnGalgame,
  PvnGalgameListResponse,
  PvnGalgameUpdatePayload,
} from '../interfaces/pvn-galgame.interface'
import { PvnApiService } from './pvn-api.service'
import { randomUUID as nodeRandomUUID } from 'node:crypto'

const PVN_GAME_DATA_SELECT = {
  pvn_galgame_id: true,
  total_play_time: true,
  last_play_date: true,
  play_type: true,
  my_rate: true,
  synced_at: true,
} as const

@Injectable()
export class PotatoVNGameMappingService {
  private readonly logger = new Logger(PotatoVNGameMappingService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly pvnApi: PvnApiService,
    @Inject(IMAGE_STORAGE) private readonly imageStorage: S3Service,
  ) {}

  async getPvnGameData(userId: number, gameId: number): Promise<PvnGameDataResDto> {
    const mapping = await this.prisma.userGamePvnMapping.findUnique({
      where: { user_id_game_id: { user_id: userId, game_id: gameId } },
      select: PVN_GAME_DATA_SELECT,
    })

    if (!mapping) {
      throw new ShionBizException(
        ShionBizCode.PVN_GAME_MAPPING_NOT_FOUND,
        'shion-biz.PVN_GAME_MAPPING_NOT_FOUND',
        undefined,
        HttpStatus.NOT_FOUND,
      )
    }

    return mapping
  }

  async addGameToPvn(userId: number, gameId: number): Promise<PvnGameDataResDto> {
    const existing = await this.prisma.userGamePvnMapping.findUnique({
      where: { user_id_game_id: { user_id: userId, game_id: gameId } },
      select: PVN_GAME_DATA_SELECT,
    })
    if (existing) {
      return existing
    }

    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      select: {
        v_id: true,
        b_id: true,
        title_jp: true,
        title_zh: true,
        title_en: true,
        tags: true,
        images: { select: { url: true, sexual: true, violence: true }, orderBy: { id: 'asc' } },
        covers: { select: { url: true, sexual: true, violence: true }, orderBy: { id: 'asc' } },
        intro_jp: true,
        intro_zh: true,
        intro_en: true,
        release_date: true,
      },
    })
    if (!game) {
      throw new ShionBizException(
        ShionBizCode.GAME_NOT_FOUND,
        'shion-biz.GAME_NOT_FOUND',
        undefined,
        HttpStatus.NOT_FOUND,
      )
    }

    const imageKey =
      game.covers.filter(cover => cover.sexual === 0 && cover.violence === 0)[0]?.url ?? null
    const imageOssLoc = imageKey ? await this.uploadImageToPvnOss(userId, gameId, imageKey) : null

    const gameInfo: PvnGalgameUpdatePayload = {
      bgmId: game.b_id,
      vndbId: game.v_id,
      name: game.title_jp || game.title_zh || game.title_en,
      cnName: game.title_zh,
      description: game.intro_zh || game.intro_jp || game.intro_en,
      tags: game.tags,
      releasedDateTimeStamp: game.release_date
        ? new Date(game.release_date).getTime() / 1000
        : null,
      playType: 0,
      ...(imageOssLoc ? { imageLoc: imageOssLoc } : {}),
    }
    const pvnGalgame = await this.pvnApi.patch<PvnGalgame>(userId, '/galgame', gameInfo)
    const playData = this.mapToPvnGameData(pvnGalgame)

    return this.prisma.userGamePvnMapping.create({
      data: {
        user_id: userId,
        game_id: gameId,
        pvn_galgame_id: pvnGalgame.id,
        total_play_time: playData.total_play_time,
        last_play_date: playData.last_play_date,
        play_type: playData.play_type,
        my_rate: playData.my_rate,
        synced_at: new Date(),
      },
      select: PVN_GAME_DATA_SELECT,
    })
  }

  async removeGameFromPvn(userId: number, gameId: number): Promise<void> {
    const mapping = await this.prisma.userGamePvnMapping.findUnique({
      where: { user_id_game_id: { user_id: userId, game_id: gameId } },
      select: { pvn_galgame_id: true },
    })
    if (!mapping) {
      throw new ShionBizException(
        ShionBizCode.PVN_GAME_MAPPING_NOT_FOUND,
        'shion-biz.PVN_GAME_MAPPING_NOT_FOUND',
        undefined,
        HttpStatus.NOT_FOUND,
      )
    }

    await this.pvnApi.delete(userId, `/galgame/${mapping.pvn_galgame_id}`)
    await this.prisma.userGamePvnMapping.delete({
      where: { user_id_game_id: { user_id: userId, game_id: gameId } },
    })
  }

  async syncLibrary(userId: number): Promise<void> {
    try {
      const pvnGalgames = await this.fetchAllPvnGalgames(userId)

      for (const pvnGame of pvnGalgames) {
        try {
          await this.upsertMappingForPvnGame(userId, pvnGame)
        } catch (err) {
          this.logger.warn(
            `Failed to upsert PVN game mapping for userId=${userId} pvnId=${pvnGame.id}: ${err?.message}`,
          )
        }
      }
    } catch (err) {
      this.logger.warn(`PVN library sync failed for userId=${userId}: ${err?.message}`)
    }
  }

  private async upsertMappingForPvnGame(userId: number, pvnGame: PvnGalgame): Promise<void> {
    const game = await this.prisma.game.findFirst({
      where: {
        OR: [
          pvnGame.bgmId ? { b_id: pvnGame.bgmId } : undefined,
          pvnGame.vndbId ? { v_id: `v${pvnGame.vndbId}` } : undefined,
        ].filter(Boolean) as object[],
      },
      select: { id: true },
    })

    if (!game) return

    const playData = this.mapToPvnGameData(pvnGame)

    await this.prisma.userGamePvnMapping.upsert({
      where: { user_id_pvn_galgame_id: { user_id: userId, pvn_galgame_id: pvnGame.id } },
      create: {
        user_id: userId,
        game_id: game.id,
        pvn_galgame_id: pvnGame.id,
        total_play_time: playData.total_play_time,
        last_play_date: playData.last_play_date,
        play_type: playData.play_type,
        my_rate: playData.my_rate,
        synced_at: new Date(),
      },
      update: {
        total_play_time: playData.total_play_time,
        last_play_date: playData.last_play_date,
        play_type: playData.play_type,
        my_rate: playData.my_rate,
        synced_at: new Date(),
      },
    })
  }

  private async fetchAllPvnGalgames(userId: number): Promise<PvnGalgame[]> {
    const results: PvnGalgame[] = []
    let pageIndex = 0
    const pageSize = 50

    while (true) {
      const data = await this.pvnApi.get<PvnGalgameListResponse>(userId, '/galgame', {
        timestamp: 0,
        pageSize,
        pageIndex,
      })

      results.push(...data.items)

      if (pageIndex >= data.pageCnt - 1) break
      pageIndex++
    }

    return results
  }

  /**
   * Downloads an image from our S3, uploads it to PVN's OSS via pre-signed URL,
   * and returns the objectFullName (imageLoc) on success, or null on failure.
   * Always calls PUT /oss/update to release pre-occupied space, even on upload failure.
   */
  private async uploadImageToPvnOss(
    userId: number,
    shionGameId: number,
    imageKey: string,
  ): Promise<string | null> {
    const uuid = nodeRandomUUID()
    const objectFullName = `shionlib/game/${shionGameId}/${uuid}.webp`

    try {
      const s3Result = await this.imageStorage.getFile(imageKey)
      if (!s3Result.Body) return null

      const buffer = Buffer.from(await s3Result.Body.transformToByteArray())
      const contentType = s3Result.ContentType ?? 'image/webp'

      const putUrl = await this.pvnApi.get<string>(userId, '/oss/put', {
        objectFullName,
        requireSpace: buffer.byteLength,
      })

      try {
        await this.pvnApi.putRaw(putUrl, buffer, contentType)
      } finally {
        await this.pvnApi
          .put(userId, '/oss/update', { objectFullName })
          .catch(err =>
            this.logger.warn(
              `Failed to update PVN OSS space for ${objectFullName}: ${err?.message}`,
            ),
          )
      }
      return objectFullName
    } catch (err) {
      this.logger.warn(
        `Failed to upload header image to PVN OSS for game ${shionGameId}: ${err?.message}`,
      )
      return null
    }
  }

  private mapToPvnGameData(
    pvnGame: PvnGalgame,
  ): Pick<PvnGameDataResDto, 'total_play_time' | 'last_play_date' | 'play_type' | 'my_rate'> {
    const sortedPlayTimes = [...pvnGame.playTime].sort((a, b) => b.dateTimeStamp - a.dateTimeStamp)
    const latestPlayTime = sortedPlayTimes[0]

    return {
      total_play_time: pvnGame.totalPlayTime,
      last_play_date: latestPlayTime ? new Date(latestPlayTime.dateTimeStamp * 1000) : null,
      play_type: pvnGame.playType,
      my_rate: pvnGame.myRate,
    }
  }
}
