import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common'
import { MoyuPatchService } from '../services/moyu-patch.service'

@Controller('moyu')
export class MoyuPatchController {
  constructor(private readonly moyuPatchService: MoyuPatchService) {}

  @Get('game/:gameId/patches')
  async getGamePatches(@Param('gameId', ParseIntPipe) gameId: number) {
    return this.moyuPatchService.getResourcesByGameId(gameId)
  }
}
