import { Injectable } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { GameHotScoreService } from '../services/game-hot-score.service'

@Injectable()
export class GameHotScoreCalcTask {
  constructor(private readonly gameHotScoreService: GameHotScoreService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handle() {
    await this.gameHotScoreService.refreshScore()
  }
}
