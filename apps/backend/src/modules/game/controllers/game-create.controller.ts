import {
  Controller,
  Get,
  Query,
  Post,
  Body,
  Req,
  UseGuards,
  Param,
  ParseIntPipe,
} from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { Roles } from '../../auth/decorators/roles.decorator'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'
import { GameDataFetcherService } from '../services/game-data-fetcher.service'
import { FetchGameDataReqDto } from '../dto/req/fetch-game-data.req.dto'
import { GameCreateService } from '../services/game-create.service'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { CreateGameFromBangumiAndVNDBReqDto } from '../dto/req/create-game-from-bangumi-and-vndb.req.dto'
import {
  CreateGameCharacterReqDto,
  CreateGameCoverReqDto,
  CreateGameDeveloperReqDto,
  CreateGameReqDto,
} from '../dto/req/create-game.req.dto'

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ShionlibUserRoles.USER)
@Controller('game/create')
export class GameCreateController {
  constructor(
    private readonly gameDataFetcherService: GameDataFetcherService,
    private readonly gameService: GameCreateService,
  ) {}

  @Get('fetch')
  async fetchData(@Query() fetchGameDataReqDto: FetchGameDataReqDto) {
    return await this.gameDataFetcherService.fetchData(
      fetchGameDataReqDto.b_id,
      fetchGameDataReqDto.v_id,
    )
  }

  @Post('frombv')
  async createGameFromBV(
    @Body() createGameReqDto: CreateGameFromBangumiAndVNDBReqDto,
    @Req() req: RequestWithUser,
  ) {
    return await this.gameService.createFromBangumiAndVNDB(
      createGameReqDto.b_id.toString(),
      createGameReqDto.v_id?.toString(),
      createGameReqDto.skip_consistency_check ?? false,
      req,
    )
  }

  @Post('game')
  async createGame(@Body() createGameReqDto: CreateGameReqDto, @Req() req: RequestWithUser) {
    return await this.gameService.createGame(createGameReqDto, req.user.sub)
  }

  @Post('/:game_id/cover')
  async createGameCover(
    @Body() createGameCoverReqDto: CreateGameCoverReqDto,
    @Param('game_id', ParseIntPipe) game_id: number,
  ) {
    return await this.gameService.createCover(createGameCoverReqDto, game_id)
  }

  @Post('/:game_id/character')
  async createGameCharacter(
    @Body() createGameCharacterReqDto: CreateGameCharacterReqDto,
    @Param('game_id', ParseIntPipe) game_id: number,
  ) {
    return await this.gameService.createCharacter(createGameCharacterReqDto, game_id)
  }

  @Post('/:game_id/developer')
  async createGameDeveloper(
    @Body() createGameDeveloperReqDto: CreateGameDeveloperReqDto,
    @Param('game_id', ParseIntPipe) game_id: number,
  ) {
    return await this.gameService.createDeveloper(createGameDeveloperReqDto, game_id)
  }
}
