import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  Body,
  ParseIntPipe,
} from '@nestjs/common'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { GameService } from '../services/game.service'
import { GetGameReqDto } from '../dto/req/get-game.req.dto'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { GameDownloadSourceService } from '../services/game-download-resource.service'
import { CreateGameDownloadSourceReqDto } from '../dto/req/create-game-download-source.req.dto'
import { GetGameListReqDto } from '../dto/req/get-game-list.req.dto'
import { SkipThrottle } from '@nestjs/throttler'
import { PaginationReqDto } from '../../../shared/dto/req/pagination.req.dto'
import { CacheService } from '../../cache/services/cache.service'
import { GetGameResDto } from '../dto/res/get-game.res.dto'
import { PaginatedResult } from '../../../shared/interfaces/response/response.interface'
import { GetGameListResDto } from '../dto/res/get-game-list.res.dto'

@Controller('game')
export class GameController {
  constructor(
    private readonly gameService: GameService,
    private readonly gameDownloadSourceService: GameDownloadSourceService,
    private readonly cacheService: CacheService,
  ) {}

  @Get('list')
  async getList(@Query() getGameListReqDto: GetGameListReqDto, @Req() req: RequestWithUser) {
    const cacheKey = `game:list:auth:${req.user?.sub}:cl:${req.user?.content_limit}:query:${JSON.stringify(getGameListReqDto)}`
    const cached = await this.cacheService.get<PaginatedResult<GetGameListResDto>>(cacheKey)
    if (cached) {
      return cached
    }
    const result = await this.gameService.getList(
      { page: getGameListReqDto.page, pageSize: getGameListReqDto.pageSize },
      req.user?.content_limit,
      getGameListReqDto.developer_id,
      getGameListReqDto.character_id,
      getGameListReqDto.filter,
    )
    await this.cacheService.set(cacheKey, result, 30 * 60 * 1000) // 30 minutes
    return result
  }

  @Get('random')
  async getRandomGame(@Req() req: RequestWithUser) {
    return await this.gameService.getRandomGameId(req)
  }

  @Get('recent-update')
  async getRecentUpdate(
    @Query() getRecentUpdateReqDto: PaginationReqDto,
    @Req() req: RequestWithUser,
  ) {
    const cacheKey = `game:recent-update:auth:${req.user?.sub}:cl:${req.user?.content_limit}:query:${JSON.stringify(getRecentUpdateReqDto)}`
    const cached = await this.cacheService.get<PaginatedResult<GetGameListResDto>>(cacheKey)
    if (cached) {
      return cached
    }
    const result = await this.gameService.getRecentUpdate(
      getRecentUpdateReqDto,
      req.user?.content_limit,
    )
    await this.cacheService.set(cacheKey, result, 30 * 60 * 1000) // 30 minutes
    return result
  }

  @Get(':id')
  async getGame(@Param() getGameReqDto: GetGameReqDto, @Req() req: RequestWithUser) {
    const cacheKey = `game:${getGameReqDto.id}:auth:${req.user.sub}:cl:${req.user.content_limit}`
    const cached = await this.cacheService.get<GetGameResDto>(cacheKey)
    if (cached) {
      return cached
    }
    const result = await this.gameService.getById(getGameReqDto.id, req.user?.content_limit)
    await this.cacheService.set(cacheKey, result, 30 * 60 * 1000) // 30 minutes
    return result
  }

  @Get(':id/header')
  async getGameHeader(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    const cacheKey = `game:${id}:header:auth:${req.user.sub}:cl:${req.user.content_limit}`
    const cached = await this.cacheService.get(cacheKey)
    if (cached) {
      return cached
    }
    const result = await this.gameService.getHeader(id, req.user?.content_limit)
    await this.cacheService.set(cacheKey, result, 30 * 60 * 1000) // 30 minutes
    return result
  }

  @Get(':id/details')
  async getGameDetails(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    const cacheKey = `game:${id}:details:auth:${req.user.sub}:cl:${req.user.content_limit}`
    const cached = await this.cacheService.get(cacheKey)
    if (cached) {
      return cached
    }
    const result = await this.gameService.getDetails(id, req.user?.content_limit)
    await this.cacheService.set(cacheKey, result, 30 * 60 * 1000) // 30 minutes
    return result
  }

  @Get(':id/characters')
  async getGameCharacters(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    const cacheKey = `game:${id}:characters:auth:${req.user.sub}:cl:${req.user.content_limit}`
    const cached = await this.cacheService.get(cacheKey)
    if (cached) {
      return cached
    }
    const result = await this.gameService.getCharacters(id, req.user?.content_limit)
    await this.cacheService.set(cacheKey, result, 30 * 60 * 1000) // 30 minutes
    return result
  }

  @Post(':id/view')
  async increaseViews(@Param('id', ParseIntPipe) id: number) {
    return await this.gameService.increaseViews(id)
  }

  @Get(':id/download-source')
  async getDownloadSource(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return await this.gameDownloadSourceService.getByGameId(id, req)
  }

  @SkipThrottle({ default: true })
  @Get('download/:id/link')
  async getDownloadSourceLink(
    @Param('id', ParseIntPipe) id: number,
    @Query('token') token: string,
  ) {
    return await this.gameDownloadSourceService.getDownloadLink(id, token)
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/download-source')
  async createDownloadSource(
    @Param('id', ParseIntPipe) id: number,
    @Body() createGameDownloadSourceReqDto: CreateGameDownloadSourceReqDto,
    @Req() req: RequestWithUser,
  ) {
    return await this.gameDownloadSourceService.create(
      createGameDownloadSourceReqDto,
      id,
      req.user?.sub,
    )
  }
}
