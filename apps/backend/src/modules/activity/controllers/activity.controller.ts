import { Controller, Get, Query } from '@nestjs/common'
import { ActivityService } from '../services/activity.service'
import { PaginationReqDto } from '../../../shared/dto/req/pagination.req.dto'

@Controller('activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get('list')
  async getList(@Query() paginationReqDto: PaginationReqDto) {
    return this.activityService.getList(paginationReqDto)
  }
}
