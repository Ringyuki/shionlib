import { Controller, Get, Req, UseGuards } from '@nestjs/common'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { UploadQuotaService } from '../services/upload-quota.service'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'

@UseGuards(JwtAuthGuard)
@Controller('uploads/quota')
export class UploadQuotaController {
  constructor(private readonly uploadQuotaService: UploadQuotaService) {}

  @Get('')
  async getQuota(@Req() req: RequestWithUser) {
    return await this.uploadQuotaService.getUploadQuota(req.user.sub)
  }
}
