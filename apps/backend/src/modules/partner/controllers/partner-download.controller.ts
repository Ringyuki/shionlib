import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common'
import { PartnerAuthGuard } from '../guards/partner-auth.guard'
import { PartnerDownloadService } from '../services/partner-download.service'
import {
  PartnerSummaryQueryReqDto,
  PartnerVndbQueryReqDto,
} from '../dto/req/partner-download.req.dto'

@UseGuards(PartnerAuthGuard)
@Controller('partner/downloads')
export class PartnerDownloadController {
  constructor(private readonly partnerDownloadService: PartnerDownloadService) {}

  @Get('summary')
  async getSummary(@Query() query: PartnerSummaryQueryReqDto) {
    return await this.partnerDownloadService.getSummary(query)
  }

  @Get()
  async getByExternalId(@Query() query: PartnerVndbQueryReqDto) {
    return await this.partnerDownloadService.getByExternalId(query.v_id, query.b_id)
  }

  @Get('file/:fileId/link')
  async getLink(@Param('fileId', ParseIntPipe) fileId: number) {
    return await this.partnerDownloadService.issueLink(fileId)
  }
}
