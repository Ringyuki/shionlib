import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { ShionConfigService } from '../../../common/config/services/config.service'

@Injectable()
export class GameHotScoreService {
  private readonly logger = new Logger(GameHotScoreService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ShionConfigService,
  ) {}

  async refreshScore() {
    const halfLifeReleaseDays = this.configService.get('game.hot_score.half_life_release_days')
    const halfLifeCreatedDays = this.configService.get('game.hot_score.half_life_created_days')
    const weightViews = this.configService.get('game.hot_score.weight_views')
    const weightDownloads = this.configService.get('game.hot_score.weight_downloads')
    const weightRelease = this.configService.get('game.hot_score.weight_release')
    const weightCreated = this.configService.get('game.hot_score.weight_created')
    const recentWindowDays = this.configService.get('game.hot_score.recent_window_days')
    const weightRecentViews = this.configService.get('game.hot_score.weight_recent_views')
    const weightRecentDownloads = this.configService.get('game.hot_score.weight_recent_downloads')

    const sql = `
      WITH base AS (
        SELECT
          g.id,
          GREATEST(1.0, EXTRACT(EPOCH FROM (NOW() - g.created)) / 86400.0) AS age_days,
          GREATEST(0.0, EXTRACT(EPOCH FROM (NOW() - COALESCE(g.release_date, g.created))) / 86400.0) AS release_age_days,
          g.views,
          g.downloads
        FROM "games" g
        WHERE g.status = 1
          AND COALESCE(g.release_date, g.created) <= NOW()
      ),
      scores AS (
        SELECT
          b.id,
          (
            ${weightViews}             * LN(b.views + 1) +
            ${weightDownloads}         * LN(b.downloads + 1) +
            ${weightRecentViews}       * LN((${recentWindowDays} * b.views) / b.age_days + 1) +
            ${weightRecentDownloads}   * LN((${recentWindowDays} * b.downloads) / b.age_days + 1) +
            ${weightRelease}           * EXP(- b.release_age_days / ${halfLifeReleaseDays}) +
            ${weightCreated}           * EXP(- b.age_days / ${halfLifeCreatedDays})
          ) AS new_score
        FROM base b
      )
      UPDATE "games" AS g
      SET "hot_score" = s.new_score
      FROM scores s
      WHERE g.id = s.id
        AND g."hot_score" IS DISTINCT FROM s.new_score;
    `
    const started = Date.now()
    const result = await this.prisma.$executeRawUnsafe(sql)
    this.logger.log(`hot_score refreshed: affected=${result}, costMs=${Date.now() - started}`)
  }
}
