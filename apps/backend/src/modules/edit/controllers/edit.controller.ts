import { Controller, Get, Param, ParseIntPipe, UseGuards, Query } from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { DataService } from '../services/data.service'
import { PaginationReqDto } from '../../../shared/dto/req/pagination.req.dto'

@Controller('edit')
export class EditController {
  constructor(private readonly dataService: DataService) {}

  @UseGuards(JwtAuthGuard)
  @Get('/game/:id/scalar')
  async getGameScalar(@Param('id', ParseIntPipe) id: number) {
    return this.dataService.getGameScalar(id)
  }

  @UseGuards(JwtAuthGuard)
  @Get('/game/:id/cover')
  async getGameCover(@Param('id', ParseIntPipe) id: number) {
    return this.dataService.getGameCover(id)
  }

  @UseGuards(JwtAuthGuard)
  @Get('/game/:id/image')
  async getGameImage(@Param('id', ParseIntPipe) id: number) {
    return this.dataService.getGameImage(id)
  }

  @UseGuards(JwtAuthGuard)
  @Get('/game/:id/developers')
  async getGameDevelopers(@Param('id', ParseIntPipe) id: number) {
    return this.dataService.getGameDevelopers(id)
  }

  @UseGuards(JwtAuthGuard)
  @Get('/game/:id/characters')
  async getGameCharacters(@Param('id', ParseIntPipe) id: number) {
    return this.dataService.getGameCharacters(id)
  }

  @Get('/game/:id/history')
  async getGameEditHistory(@Param('id', ParseIntPipe) id: number, @Query() dto: PaginationReqDto) {
    return this.dataService.getGameEditHistory(id, dto)
  }

  @UseGuards(JwtAuthGuard)
  @Get('/developer/:id/scalar')
  async getDeveloperScalar(@Param('id', ParseIntPipe) id: number) {
    return this.dataService.getDeveloperScalar(id)
  }

  @Get('/developer/:id/history')
  async getDeveloperEditHistory(
    @Param('id', ParseIntPipe) id: number,
    @Query() dto: PaginationReqDto,
  ) {
    return this.dataService.getDeveloperEditHistory(id, dto)
  }

  @UseGuards(JwtAuthGuard)
  @Get('/character/:id/scalar')
  async getCharacterScalar(@Param('id', ParseIntPipe) id: number) {
    return this.dataService.getCharacterScalar(id)
  }

  @Get('/character/:id/history')
  async getCharacterEditHistory(
    @Param('id', ParseIntPipe) id: number,
    @Query() dto: PaginationReqDto,
  ) {
    return this.dataService.getCharacterEditHistory(id, dto)
  }
}
