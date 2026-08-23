import { forwardRef, Module } from '@nestjs/common'
import { GameController } from './controllers/game.controller'
import { GameService } from './services/game.service'
import { GameDownloadSourceService } from './services/game-download-resource.service'
import { B2Module } from '../b2/b2.module'
import { GameHotScoreService } from './services/game-hot-score.service'
import { GameHotScoreCalcTask } from './tasks/game-hot-score-calc.task'
import { GameDownloadSourceController } from './controllers/game-download-source.controller'
import { HttpModule } from '@nestjs/axios'
import { BangumiModule } from '../bangumi/bangumi.module'
import { HikarinagiModule } from '../hikarinagi/hikarinagi.module'
import { GameScoreService } from './services/game-score.service'
import { GameScoreController } from './controllers/game-score.controller'
import { GameDownloadResourceReportService } from './services/game-download-resource-report.service'
import { DownloadProxyTicketService } from './services/download-proxy-ticket.service'

@Module({
  controllers: [GameController, GameDownloadSourceController, GameScoreController],
  imports: [B2Module, HttpModule, BangumiModule, forwardRef(() => HikarinagiModule)],
  providers: [
    GameService,
    GameController,
    GameDownloadSourceService,
    GameHotScoreService,
    GameHotScoreCalcTask,
    GameScoreService,
    GameDownloadResourceReportService,
    DownloadProxyTicketService,
  ],
  exports: [GameService, GameDownloadResourceReportService, GameDownloadSourceService],
})
export class GameModule {}
