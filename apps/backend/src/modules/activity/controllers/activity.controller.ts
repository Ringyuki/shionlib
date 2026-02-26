import { Controller, Get, Query, Req } from '@nestjs/common'
import { ActivityService } from '../services/activity.service'
import { PaginationReqDto } from '../../../shared/dto/req/pagination.req.dto'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'

@Controller('activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get('list')
  async getList(@Query() paginationReqDto: PaginationReqDto, @Req() req: RequestWithUser) {
    return this.activityService.getList(paginationReqDto, req)
  }
}
