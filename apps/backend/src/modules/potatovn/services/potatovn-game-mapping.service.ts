import { HttpStatus, Injectable, Logger } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { firstValueFrom } from 'rxjs'
import { PrismaService } from '../../../prisma.service'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { PvnGameDataResDto } from '../dto/res/pvn-game-data.res.dto'
import { PvnGalgame, PvnGalgameListResponse } from '../interfaces/pvn-galgame.interface'

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
  private readonly pvnBaseUrl: string

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly configService: ShionConfigService,
  ) {
    this.pvnBaseUrl = this.configService.get('potatovn.baseUrl')
  }

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

    const token = await this.fetchPvnToken(userId)
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      select: {
        v_id: true,
        b_id: true,
        title_jp: true,
        title_zh: true,
        title_en: true,
        tags: true,
        covers: { select: { url: true, sexual: true, violence: true }, orderBy: { id: 'asc' } },
        images: { select: { url: true, sexual: true, violence: true }, orderBy: { id: 'asc' } },
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

    const gameInfo = {
      bgmId: game.b_id,
      vndbId: game.v_id,
      name: game.title_jp || game.title_zh || game.title_en,
      cnName: game.title_zh,
      imageUrl:
        game.covers.filter(cover => cover.sexual === 0 && cover.violence === 0)[0]?.url ?? null,
      headerImageUrl:
        game.images.filter(image => image.sexual === 0 && image.violence === 0)[0]?.url ?? null,
      description: game.intro_zh || game.intro_jp || game.intro_en,
      tags: game.tags,
      releasedDateTimeStamp: game.release_date ? new Date(game.release_date).getTime() : null,
      playType: 0,
    }
    const pvnGalgame = await this.callCreatePvnGalgame(token, gameInfo)
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

  async syncLibrary(userId: number): Promise<void> {
    try {
      const token = await this.fetchPvnToken(userId)
      const pvnGalgames = await this.fetchAllPvnGalgames(token)

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
      where: { user_id_game_id: { user_id: userId, game_id: game.id } },
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
        pvn_galgame_id: pvnGame.id,
        total_play_time: playData.total_play_time,
        last_play_date: playData.last_play_date,
        play_type: playData.play_type,
        my_rate: playData.my_rate,
        synced_at: new Date(),
      },
    })
  }

  private async fetchPvnToken(userId: number): Promise<string> {
    const binding = await this.prisma.userPvnBinding.findUnique({
      where: { user_id: userId },
      select: { pvn_token: true },
    })

    if (!binding) {
      throw new ShionBizException(
        ShionBizCode.PVN_BINDING_NOT_FOUND,
        'shion-biz.PVN_BINDING_NOT_FOUND',
        undefined,
        HttpStatus.NOT_FOUND,
      )
    }

    return binding.pvn_token
  }

  private async fetchAllPvnGalgames(token: string): Promise<PvnGalgame[]> {
    const results: PvnGalgame[] = []
    let pageIndex = 0
    const pageSize = 50

    while (true) {
      const { data } = await firstValueFrom(
        this.httpService.get<PvnGalgameListResponse>(`${this.pvnBaseUrl}/galgame`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { timestamp: 0, pageSize, pageIndex },
        }),
      )

      results.push(...data.items)

      if (pageIndex >= data.pageCnt - 1) break
      pageIndex++
    }

    return results
  }

  private async callCreatePvnGalgame(
    token: string,
    gameInfo: Partial<PvnGalgame>,
  ): Promise<PvnGalgame> {
    const { data } = await firstValueFrom(
      this.httpService.patch<PvnGalgame>(`${this.pvnBaseUrl}/galgame`, gameInfo, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    )
    return data
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
