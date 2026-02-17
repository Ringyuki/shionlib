import { Module } from '@nestjs/common'
import { GameCreateController } from './controllers/game-create.controller'
import { GameController } from './controllers/game.controller'
import { GameDataFetcherService } from './services/game-data-fetcher.service'
import { GameService } from './services/game.service'
import { GameCreateService } from './services/game-create.service'
import { GameDownloadSourceService } from './services/game-download-resource.service'
import { B2Module } from '../b2/b2.module'
import { GameEditService } from './services/game-edit.service'
import { GameEditController } from './controllers/game-edit.controller'
import { GameHotScoreService } from './services/game-hot-score.service'
import { GameHotScoreCalcTask } from './tasks/game-hot-score-calc.task'
import { GameDownloadSourceController } from './controllers/game-download-source.controller'
import { HttpModule } from '@nestjs/axios'
import { GameScoreService } from './services/game-score.service'
import { GameScoreController } from './controllers/game-score.controller'
import { GameDownloadResourceReportService } from './services/game-download-resource-report.service'

@Module({
  controllers: [
    GameCreateController,
    GameController,
    GameEditController,
    GameDownloadSourceController,
    GameScoreController,
  ],
  imports: [B2Module, HttpModule],
  providers: [
    GameDataFetcherService,
    GameService,
    GameController,
    GameCreateService,
    GameDownloadSourceService,
    GameEditService,
    GameHotScoreService,
    GameHotScoreCalcTask,
    GameScoreService,
    GameDownloadResourceReportService,
  ],
  exports: [GameService, GameDownloadResourceReportService],
})
export class GameModule {}
