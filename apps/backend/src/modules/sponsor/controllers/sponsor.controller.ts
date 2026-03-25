import { Controller, Get, Post, Body, Param, Query, Req, ParseIntPipe } from '@nestjs/common'
import { SponsorService } from '../services/sponsor.service'
import { SponsorWallService } from '../services/sponsor-wall.service'
import { CreateSponsorOrderReqDto } from '../dto/req/create-sponsor-order.req.dto'
import { PaySponsorOrderReqDto } from '../dto/req/pay-sponsor-order.req.dto'
import { GetSponsorWallReqDto } from '../dto/req/get-sponsor-wall.req.dto'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { CacheService } from '../../cache/services/cache.service'
import { PaginatedResult } from '../../../shared/interfaces/response/response.interface'
import { SponsorWallItemResDto } from '../dto/res/sponsor-wall-item.res.dto'

@Controller('sponsor')
export class SponsorController {
  constructor(
    private readonly sponsorService: SponsorService,
    private readonly sponsorWallService: SponsorWallService,
    private readonly cacheService: CacheService,
  ) {}

  @Post('order')
  async createOrder(@Body() dto: CreateSponsorOrderReqDto, @Req() req: RequestWithUser) {
    return this.sponsorService.createOrder(dto, req.user?.sub)
  }

  @Post('order/:id/pay')
  async payOrder(@Param('id', ParseIntPipe) id: number, @Body() dto: PaySponsorOrderReqDto) {
    return this.sponsorService.payOrder(id, dto)
  }

  @Get('order/:id')
  async getOrderStatus(@Param('id', ParseIntPipe) id: number) {
    return this.sponsorService.getOrderStatus(id)
  }

  @Get('wall')
  async getWall(@Query() dto: GetSponsorWallReqDto) {
    const cacheKey = `sponsor:wall:p${dto.page}:ps${dto.pageSize}`
    const cached = await this.cacheService.get<PaginatedResult<SponsorWallItemResDto>>(cacheKey)
    if (cached) return cached
    const result = await this.sponsorWallService.getWall(dto)
    await this.cacheService.set(cacheKey, result, 300_000) // 5 minutes
    return result
  }

  @Get('stats')
  async getStats() {
    return this.sponsorService.getPublicStats()
  }
}
