import { Controller, Req, UseGuards, Body, Post } from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { PermissionService } from '../services/permission.service'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { GetPermissionsReqDto } from '../dto/req/get-permissons.req.dto'

@UseGuards(JwtAuthGuard)
@Controller('permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Post('')
  async getPermissions(@Req() req: RequestWithUser, @Body() dto: GetPermissionsReqDto) {
    return this.permissionService.getPermissionDetails(req.user.sub, req.user.role, dto.entity)
  }
}
