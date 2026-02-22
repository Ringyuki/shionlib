import { Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { PotatoVNGameMappingService } from '../services/potatovn-game-mapping.service'

@Controller('potatovn/game')
@UseGuards(JwtAuthGuard)
export class PotatoVNGameMappingController {
  constructor(private readonly potatovnGameMappingService: PotatoVNGameMappingService) {}

  @Get(':gameId')
  async getPvnGameData(@Param('gameId', ParseIntPipe) gameId: number, @Req() req: RequestWithUser) {
    return this.potatovnGameMappingService.getPvnGameData(req.user.sub, gameId)
  }

  @Post(':gameId')
  async addGameToPvn(@Param('gameId', ParseIntPipe) gameId: number, @Req() req: RequestWithUser) {
    return this.potatovnGameMappingService.addGameToPvn(req.user.sub, gameId)
  }
}
