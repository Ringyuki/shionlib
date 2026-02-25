import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { Roles } from '../../auth/decorators/roles.decorator'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'
import { AdminWalkthroughService } from '../services/admin-walkthrough.service'
import { AdminWalkthroughListReqDto } from '../dto/req/walkthrough-list.req.dto'
import { AdminUpdateWalkthroughStatusReqDto } from '../dto/req/walkthrough-status.req.dto'

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ShionlibUserRoles.ADMIN)
@Controller('admin/walkthroughs')
export class AdminWalkthroughController {
  constructor(private readonly adminWalkthroughService: AdminWalkthroughService) {}

  @Get()
  async getWalkthroughList(@Query() query: AdminWalkthroughListReqDto) {
    return this.adminWalkthroughService.getWalkthroughList(query)
  }

  @Get(':id')
  async getWalkthroughDetail(@Param('id', ParseIntPipe) id: number) {
    return this.adminWalkthroughService.getWalkthroughDetail(id)
  }

  @Patch(':id/status')
  async updateWalkthroughStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminUpdateWalkthroughStatusReqDto,
  ) {
    return this.adminWalkthroughService.updateWalkthroughStatus(id, dto)
  }

  @Post(':id/rescan')
  async rescanWalkthrough(@Param('id', ParseIntPipe) id: number) {
    return this.adminWalkthroughService.rescanWalkthrough(id)
  }
}
