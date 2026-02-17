import {
  Controller,
  UseGuards,
  Post,
  Body,
  Param,
  ParseIntPipe,
  Req,
  Patch,
  Get,
  Query,
  Delete,
  Put,
} from '@nestjs/common'
import { GameDownloadSourceService } from '../services/game-download-resource.service'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { Roles } from '../../auth/decorators/roles.decorator'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'
import { MigrateCreateGameDownloadSourceReqDto } from '../dto/req/create-game-download-source.req.dto'
import { CreateGameDownloadSourceFileReqDto } from '../dto/req/create-game-download-source-file.req.dto'
import { EditGameDownloadSourceReqDto } from '../dto/req/edit-game-download-source.req.dto'
import { ReuploadFileReqDto } from '../dto/req/reupload-file.req.dto'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { PaginationReqDto } from '../../../shared/dto/req/pagination.req.dto'
import { CreateGameDownloadSourceReportReqDto } from '../dto/req/create-game-download-source-report.req.dto'
import { GameDownloadResourceReportService } from '../services/game-download-resource-report.service'

@Controller('game/download-source')
export class GameDownloadSourceController {
  constructor(
    private readonly gameDownloadSourceService: GameDownloadSourceService,
    private readonly gameDownloadSourceReportService: GameDownloadResourceReportService,
  ) {}

  @Get('list')
  async getDownloadSourceList(@Query() getDownloadSourceListReqDto: PaginationReqDto) {
    return await this.gameDownloadSourceService.getList(getDownloadSourceListReqDto)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete(':id')
  async deleteDownloadResource(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return await this.gameDownloadSourceService.delete(id, req)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id')
  async editDownloadResource(
    @Body() editDownloadResourceReqDto: EditGameDownloadSourceReqDto,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return await this.gameDownloadSourceService.edit(id, editDownloadResourceReqDto, req)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ShionlibUserRoles.SUPER_ADMIN)
  @Post('migrate/:game-id')
  async createDownloadResource(
    @Body() migrateCreateDownloadResourceReqDto: MigrateCreateGameDownloadSourceReqDto,
    @Param('game-id', ParseIntPipe) game_id: number,
  ) {
    return await this.gameDownloadSourceService.migrateCreate(
      migrateCreateDownloadResourceReqDto,
      game_id,
    )
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ShionlibUserRoles.SUPER_ADMIN)
  @Post('migrate/file/:download-source-id')
  async createDownloadResourceFile(
    @Body() createDownloadResourceFileReqDto: CreateGameDownloadSourceFileReqDto,
    @Param('download-source-id', ParseIntPipe) download_source_id: number,
  ) {
    return await this.gameDownloadSourceService.migrateCreateFile(
      createDownloadResourceFileReqDto,
      download_source_id,
    )
  }

  @UseGuards(JwtAuthGuard)
  @Put('file/:fileId/reupload')
  async reuploadFile(
    @Param('fileId', ParseIntPipe) fileId: number,
    @Body() reuploadFileReqDto: ReuploadFileReqDto,
    @Req() req: RequestWithUser,
  ) {
    return await this.gameDownloadSourceService.reuploadFile(fileId, reuploadFileReqDto, req)
  }

  @Get('file/:fileId/history')
  async getFileHistory(@Param('fileId', ParseIntPipe) fileId: number) {
    return await this.gameDownloadSourceService.getFileHistory(fileId)
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/report')
  async reportDownloadResource(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateGameDownloadSourceReportReqDto,
    @Req() req: RequestWithUser,
  ) {
    return await this.gameDownloadSourceReportService.create(id, dto, req.user.sub)
  }
}
