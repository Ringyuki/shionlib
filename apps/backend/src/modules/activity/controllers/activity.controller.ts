import { Controller, Get, Query, Req } from '@nestjs/common'
import { ActivityService } from '../services/activity.service'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { GetActivityListReqDto } from '../dto/req/get-activity-list.req.dto'

@Controller('activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get('list')
  async getList(@Query() dto: GetActivityListReqDto, @Req() req: RequestWithUser) {
    return this.activityService.getList(dto, req)
  }
}
