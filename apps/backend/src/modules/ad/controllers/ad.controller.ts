import { Controller, Get, Param } from '@nestjs/common'
import { AdService } from '../services/ad.service'
import { CacheService } from '../../cache/services/cache.service'
import { AdItemResDto } from '../dto/res/ad-item.res.dto'

@Controller('ad')
export class AdController {
  constructor(
    private readonly adService: AdService,
    private readonly cacheService: CacheService,
  ) {}

  @Get('placement/:placement')
  async getAdsByPlacement(@Param('placement') placement: string): Promise<AdItemResDto[]> {
    const cacheKey = `ad:placement:${placement}`
    const cached = await this.cacheService.get<AdItemResDto[]>(cacheKey)
    if (cached) return cached

    const result = await this.adService.getAdsByPlacement(placement)
    await this.cacheService.set(cacheKey, result, 300_000)
    return result
  }
}
