import { Controller, Get, Query } from '@nestjs/common'
import { BangumiAuthService } from '../services/bangumi-auth.service'

@Controller('bangumi')
export class BangumiController {
  constructor(private readonly bangumiAuthService: BangumiAuthService) {}

  @Get('get')
  async search(
    @Query('path') path: string = 'subjects',
    @Query('id') id: string,
    @Query('type') type?: string,
  ) {
    return await this.bangumiAuthService.bangumiRequest(
      `https://api.bgm.tv/v0/${path}/${id}${type ? `/${type}` : ''}`,
      'GET',
    )
  }
}
