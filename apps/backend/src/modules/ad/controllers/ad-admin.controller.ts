import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Query,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { Roles } from '../../auth/decorators/roles.decorator'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'
import { AdService } from '../services/ad.service'
import { GetAdListReqDto } from '../dto/req/get-ad-list.req.dto'
import { CreateAdReqDto } from '../dto/req/create-ad.req.dto'
import { UpdateAdReqDto } from '../dto/req/update-ad.req.dto'

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ShionlibUserRoles.ADMIN)
@Controller('admin/ad')
export class AdAdminController {
  constructor(private readonly adService: AdService) {}

  @Get()
  async getAdList(@Query() dto: GetAdListReqDto) {
    return this.adService.getAdList(dto)
  }

  @Get(':id')
  async getAdDetail(@Param('id', ParseIntPipe) id: number) {
    return this.adService.getAdDetail(id)
  }

  @Post()
  async createAd(@Body() dto: CreateAdReqDto) {
    return this.adService.createAd(dto)
  }

  @Patch(':id')
  async updateAd(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAdReqDto) {
    return this.adService.updateAd(id, dto)
  }

  @Delete(':id')
  async deleteAd(@Param('id', ParseIntPipe) id: number) {
    await this.adService.deleteAd(id)
  }
}
