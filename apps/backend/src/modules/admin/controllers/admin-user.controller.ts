import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  Req,
} from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { Roles } from '../../auth/decorators/roles.decorator'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'
import { AdminUserService } from '../services/admin-user.service'
import { AdminUserListReqDto, AdminUserSessionsReqDto } from '../dto/req/user-list.req.dto'
import {
  AdminUpdateUserProfileReqDto,
  AdminUpdateUserRoleReqDto,
} from '../dto/req/user-update.req.dto'
import { AdminResetPasswordReqDto } from '../dto/req/reset-password.req.dto'
import { BanUserReqDto } from '../../user/dto/req/ban-user.req.dto'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import {
  AdminUserPermissionsReqDto,
  AdminUpdateUserPermissionsReqDto,
} from '../dto/req/user-permissions.req.dto'
import {
  AdminAdjustQuotaSizeReqDto,
  AdminAdjustQuotaUsedReqDto,
} from '../dto/req/user-quota.req.dto'

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ShionlibUserRoles.ADMIN)
@Controller('admin/users')
export class AdminUserController {
  constructor(private readonly adminUserService: AdminUserService) {}

  @Get()
  async getUsers(@Query() query: AdminUserListReqDto) {
    return this.adminUserService.getUserList(query)
  }

  @Get(':id')
  async getUserDetail(@Param('id', ParseIntPipe) id: number) {
    return this.adminUserService.getUserDetail(id)
  }

  @Patch(':id/profile')
  async updateUserProfile(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminUpdateUserProfileReqDto,
    @Req() req: RequestWithUser,
  ) {
    return this.adminUserService.updateUserProfile(id, dto, req.user)
  }

  @Patch(':id/role')
  async updateUserRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminUpdateUserRoleReqDto,
    @Req() req: RequestWithUser,
  ) {
    return this.adminUserService.updateUserRole(id, dto, req.user)
  }

  @Post(':id/ban')
  async banUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: BanUserReqDto,
    @Req() req: RequestWithUser,
  ) {
    return this.adminUserService.banUser(id, dto, req.user)
  }

  @Post(':id/unban')
  async unbanUser(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.adminUserService.unbanUser(id, req.user)
  }

  @Post(':id/reset-password')
  async resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminResetPasswordReqDto,
    @Req() req: RequestWithUser,
  ) {
    return this.adminUserService.resetPassword(id, dto, req.user)
  }

  @Post(':id/force-logout')
  async forceLogout(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.adminUserService.forceLogout(id, req.user)
  }

  @Get(':id/sessions')
  async getSessions(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: AdminUserSessionsReqDto,
  ) {
    return this.adminUserService.getUserSessions(id, query)
  }

  @Get(':id/permissions')
  async getUserPermissions(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: AdminUserPermissionsReqDto,
    @Req() req: RequestWithUser,
  ) {
    return this.adminUserService.getUserEditPermissions(id, query.entity, req.user)
  }

  @Patch(':id/permissions')
  async updateUserPermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminUpdateUserPermissionsReqDto,
    @Req() req: RequestWithUser,
  ) {
    return this.adminUserService.updateUserEditPermissions(id, dto.entity, dto.allowBits, req.user)
  }

  @Patch(':id/quota/size')
  async adjustQuotaSize(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminAdjustQuotaSizeReqDto,
    @Req() req: RequestWithUser,
  ) {
    return this.adminUserService.adjustUserUploadQuotaSize(id, dto, req.user)
  }

  @Patch(':id/quota/used')
  async adjustQuotaUsed(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminAdjustQuotaUsedReqDto,
    @Req() req: RequestWithUser,
  ) {
    return this.adminUserService.adjustUserUploadQuotaUsed(id, dto, req.user)
  }

  @Post(':id/quota/reset-used')
  async resetQuotaUsed(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.adminUserService.resetUserUploadQuotaUsed(id, req.user)
  }
}
