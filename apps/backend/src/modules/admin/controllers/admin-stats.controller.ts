import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { AdminStatsService } from '../services/admin-stats.service'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { Roles } from '../../auth/decorators/roles.decorator'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'
import { StatsTrendReqDto } from '../dto/req/stats.req.dto'

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ShionlibUserRoles.ADMIN)
@Controller('admin/stats')
export class AdminStatsController {
  constructor(private readonly adminStatsService: AdminStatsService) {}

  @Get('overview')
  async getOverview() {
    return this.adminStatsService.getOverview()
  }

  @Get('trends')
  async getTrends(@Query() query: StatsTrendReqDto) {
    return this.adminStatsService.getTrends(query.days)
  }
}
