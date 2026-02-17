import { Controller, Delete, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common'
import { DeveloperService } from '../services/developer.service'
import { GetListReqDto } from '../dto/req/get-list.req.dto'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { Roles } from '../../auth/decorators/roles.decorator'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'

@Controller('developer')
export class DeveloperController {
  constructor(private readonly developerService: DeveloperService) {}

  @Get('list')
  async getList(@Query() dto: GetListReqDto) {
    return this.developerService.getList(dto)
  }

  @Get(':id')
  async getById(@Param('id', ParseIntPipe) id: number) {
    return this.developerService.getById(id)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ShionlibUserRoles.ADMIN)
  @Delete(':id')
  async deleteById(@Param('id', ParseIntPipe) id: number) {
    return this.developerService.deleteById(id)
  }
}
