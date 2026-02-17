import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  Body,
  Put,
  ParseIntPipe,
  Patch,
  Delete,
} from '@nestjs/common'
import { FavoriteService } from '../services/favorite.service'
import { GetFavoriteItemsReqDto } from '../dto/req/get-favorite-items.req.dto'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { CreateFavoriteReqDto } from '../dto/req/create-favorite.req.dto'
import { UpdateFavoriteReqDto } from '../dto/req/update-favorite.req.dto'
import { UpdateFavoriteItemReqDto } from '../dto/req/update-favorite-item.req.dto'
import { CreateFavoriteItemReqDto } from '../dto/req/create-favorite-item.req.dto'
import { GetFavoritesReqDto } from '../dto/req/get-favorites.req.dto'
import { Public } from '../../auth/decorators/public.decorator'

@UseGuards(JwtAuthGuard)
@Controller('favorites')
export class FavoriteController {
  constructor(private readonly favoriteService: FavoriteService) {}

  @Post('')
  async createFavorite(@Body() dto: CreateFavoriteReqDto, @Req() req: RequestWithUser) {
    return this.favoriteService.createFavorite(dto, req.user?.sub)
  }

  @Put(':id')
  async addGameToFavorite(
    @Param('id', ParseIntPipe) favorite_id: number,
    @Body() dto: CreateFavoriteItemReqDto,
    @Req() req: RequestWithUser,
  ) {
    return this.favoriteService.addGameToFavorite(favorite_id, req.user?.sub, dto)
  }

  @Patch(':id')
  async updateFavorite(
    @Param('id', ParseIntPipe) favorite_id: number,
    @Body() dto: UpdateFavoriteReqDto,
    @Req() req: RequestWithUser,
  ) {
    return this.favoriteService.updateFavorite(favorite_id, req.user?.sub, dto)
  }

  @Delete(':id')
  async deleteFavorite(
    @Param('id', ParseIntPipe) favorite_id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.favoriteService.deleteFavorite(favorite_id, req.user?.sub)
  }

  @Patch('items/:item_id')
  async updateFavoriteItem(
    @Param('item_id', ParseIntPipe) item_id: number,
    @Body() dto: UpdateFavoriteItemReqDto,
    @Req() req: RequestWithUser,
  ) {
    return this.favoriteService.updateFavoriteItem(item_id, req.user?.sub, dto)
  }

  @Delete('items/:item_id')
  async deleteFavoriteItem(
    @Param('item_id', ParseIntPipe) item_id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.favoriteService.deleteFavoriteItem(item_id, req.user?.sub)
  }

  @Delete(':id/games/:game_id')
  async deleteFavoriteItemByGameId(
    @Param('id', ParseIntPipe) favorite_id: number,
    @Param('game_id', ParseIntPipe) game_id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.favoriteService.deleteFavoriteItemByGameId(favorite_id, game_id, req.user?.sub)
  }

  @Public()
  @Get('')
  async getFavorites(@Req() req: RequestWithUser, @Query() dto: GetFavoritesReqDto) {
    return this.favoriteService.getFavorites(req.user?.sub, dto)
  }

  @Public()
  @Get(':id/items')
  async getFavoriteItems(
    @Param('id', ParseIntPipe) favorite_id: number,
    @Query() dto: GetFavoriteItemsReqDto,
    @Req() req: RequestWithUser,
  ) {
    return this.favoriteService.getFavoriteItems(favorite_id, dto, req)
  }

  @Get('/game/:id/stats')
  async getFavoriteStats(@Param('id', ParseIntPipe) game_id: number, @Req() req: RequestWithUser) {
    return this.favoriteService.getFavoriteStats(req.user?.sub, game_id)
  }
}
