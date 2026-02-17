import {
  Controller,
  Get,
  Patch,
  Delete,
  Put,
  Param,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
  Req,
} from '@nestjs/common'
import { AdminContentService } from '../services/admin-content.service'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { Roles } from '../../auth/decorators/roles.decorator'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'
import { AdminGameListReqDto } from '../dto/req/game-list.req.dto'
import { AdminCharacterListReqDto, AdminDeveloperListReqDto } from '../dto/req/content-list.req.dto'
import { GetDownloadResourceReportListReqDto } from '../dto/req/download-resource-report-list.req.dto'
import { ReviewGameDownloadSourceReportReqDto } from '../dto/req/review-game-download-source-report.req.dto'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { GetMalwareScanCaseListReqDto } from '../../security/dto/req/get-malware-scan-case-list.req.dto'
import { ReviewMalwareScanCaseReqDto } from '../../security/dto/req/review-malware-scan-case.req.dto'
import { AdminGameService } from '../services/admin-game.service'

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ShionlibUserRoles.ADMIN)
@Controller('admin/content')
export class AdminContentController {
  constructor(
    private readonly adminContentService: AdminContentService,
    private readonly adminGameService: AdminGameService,
  ) {}

  @Get('games')
  async getGameList(@Query() query: AdminGameListReqDto) {
    return this.adminContentService.getGameList(query)
  }

  @Patch('games/:id/status')
  async updateGameStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status', ParseIntPipe) status: number,
  ) {
    return await this.adminContentService.updateGameStatus(id, status)
  }

  @Get('games/:id/edit/scalar')
  async getGameScalar(@Param('id', ParseIntPipe) id: number) {
    return await this.adminGameService.getScalar(id)
  }

  @Patch('games/:id/edit/scalar')
  async editGameScalar(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, any>) {
    return await this.adminContentService.editGameScalar(id, body)
  }

  @Delete('games/:id')
  async deleteGame(@Param('id', ParseIntPipe) id: number) {
    return await this.adminContentService.deleteGame(id)
  }

  @Put('games/:id/recent-update')
  async addGameToRecentUpdate(@Param('id', ParseIntPipe) id: number) {
    return await this.adminContentService.addGameToRecentUpdate(id)
  }

  @Delete('games/:id/recent-update')
  async removeGameFromRecentUpdate(@Param('id', ParseIntPipe) id: number) {
    return await this.adminContentService.removeGameFromRecentUpdate(id)
  }

  @Get('characters')
  async getCharacterList(@Query() query: AdminCharacterListReqDto) {
    return this.adminContentService.getCharacterList(query)
  }

  @Get('developers')
  async getDeveloperList(@Query() query: AdminDeveloperListReqDto) {
    return this.adminContentService.getDeveloperList(query)
  }

  @Get('download-resource-reports')
  async getDownloadResourceReportList(@Query() query: GetDownloadResourceReportListReqDto) {
    return this.adminContentService.getDownloadResourceReportList(query)
  }

  @Get('download-resource-reports/:id')
  async getDownloadResourceReportDetail(@Param('id', ParseIntPipe) id: number) {
    return this.adminContentService.getDownloadResourceReportDetail(id)
  }

  @Patch('download-resource-reports/:id/review')
  async reviewDownloadResourceReport(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewGameDownloadSourceReportReqDto,
    @Req() req: RequestWithUser,
  ) {
    return this.adminContentService.reviewDownloadResourceReport(id, dto, req.user)
  }

  @Get('malware-scan-cases')
  async getMalwareScanCaseList(@Query() query: GetMalwareScanCaseListReqDto) {
    return this.adminContentService.getMalwareScanCaseList(query)
  }

  @Get('malware-scan-cases/:id')
  async getMalwareScanCaseDetail(@Param('id', ParseIntPipe) id: number) {
    return this.adminContentService.getMalwareScanCaseDetail(id)
  }

  @Patch('malware-scan-cases/:id/review')
  async reviewMalwareScanCase(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewMalwareScanCaseReqDto,
    @Req() req: RequestWithUser,
  ) {
    return this.adminContentService.reviewMalwareScanCase(id, dto, req.user)
  }
}
