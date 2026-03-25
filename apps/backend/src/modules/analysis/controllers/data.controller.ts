import { Controller, Get } from '@nestjs/common'
import { DataService } from '../services/data.service'
import { CacheService } from '../../cache/services/cache.service'
import { GetOverviewResDto } from '../dto/get-overview.res.dto'
import { GetTrafficDetailResDto } from '../dto/get-traffic-detail.res.dto'

@Controller('analysis/data')
export class AnalysisDataController {
  constructor(
    private readonly dataService: DataService,
    private readonly cacheService: CacheService,
  ) {}

  @Get('overview')
  async getOverview() {
    const cacheKey = 'analysis:data:overview'
    const cached = await this.cacheService.get<GetOverviewResDto>(cacheKey)
    if (cached) {
      return cached
    }
    const result = await this.dataService.getOverview()
    await this.cacheService.set(cacheKey, result, 30 * 60 * 1000) // 30 minutes
    return result
  }

  @Get('traffic-detail')
  async getTrafficDetail() {
    const cacheKey = 'analysis:data:traffic-detail'
    const cached = await this.cacheService.get<GetTrafficDetailResDto>(cacheKey)
    if (cached) {
      return cached
    }
    const result = await this.dataService.getTrafficDetail()
    await this.cacheService.set(cacheKey, result, 10 * 60 * 1000) // 10 minutes
    return result
  }
}
