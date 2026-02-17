import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common'
import { GameScoreService } from '../services/game-score.service'

@Controller('game/score')
export class GameScoreController {
  constructor(private readonly gameScoreService: GameScoreService) {}

  @Get('/bangumi/:id')
  async getScore(@Param('id', ParseIntPipe) id: number) {
    return await this.gameScoreService.getBangumiScore(id)
  }

  @Get('/vndb/:id')
  async getVNDBScore(@Param('id', ParseIntPipe) id: number) {
    return await this.gameScoreService.getVNDBScore(id)
  }
}
