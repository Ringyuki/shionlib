import { Controller, Get, UseGuards, Inject, Delete, Query } from '@nestjs/common'
import { S3Service } from '../services/s3.service'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { Roles } from '../../auth/decorators/roles.decorator'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'
import { GAME_STORAGE } from '../constants/s3.constants'

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ShionlibUserRoles.SUPER_ADMIN)
@Controller('s3/test')
export class AdminTestController {
  constructor(@Inject(GAME_STORAGE) private readonly s3Service: S3Service) {}

  @Get('file/list')
  async getFileList() {
    return await this.s3Service.getFileList()
  }

  @Delete('file')
  async deleteFile(@Query('key') key: string) {
    return await this.s3Service.deleteFile(key)
  }
}
