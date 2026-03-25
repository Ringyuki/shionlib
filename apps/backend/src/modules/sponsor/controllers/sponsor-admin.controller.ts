import { Controller, Get, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { Roles } from '../../auth/decorators/roles.decorator'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'
import { GetSponsorOrderListReqDto } from '../dto/req/get-sponsor-order-list.req.dto'
import { SponsorService } from '../services/sponsor.service'

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ShionlibUserRoles.ADMIN)
@Controller('admin/sponsor')
export class SponsorAdminController {
  constructor(private readonly sponsorService: SponsorService) {}

  @Get('orders')
  async getOrders(@Query() dto: GetSponsorOrderListReqDto) {
    return this.sponsorService.getOrderList(dto)
  }

  @Get('orders/:id')
  async getOrder(@Param('id', ParseIntPipe) id: number) {
    return this.sponsorService.getOrderStatus(id)
  }

  @Get('stats')
  async getStats() {
    return this.sponsorService.getPublicStats()
  }
}
