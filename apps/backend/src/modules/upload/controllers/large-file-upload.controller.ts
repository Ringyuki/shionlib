import {
  Controller,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Req,
  Param,
  UseGuards,
  Get,
  ParseIntPipe,
} from '@nestjs/common'
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { LargeFileUploadService } from '../services/large-file-upload.service'
import { GameUploadReqDto } from '../dto/req/game-upload.req.dto'
import { Throttle } from '@nestjs/throttler'

@UseGuards(JwtAuthGuard)
@Controller('uploads/large')
export class LargeFileUploadController {
  constructor(private readonly largeFileUploadService: LargeFileUploadService) {}

  @Get('ongoing')
  async getOngoingSessions(@Req() req: RequestWithUser) {
    return await this.largeFileUploadService.getOngoingSessions(req)
  }

  @Post('init')
  async init(@Body() body: GameUploadReqDto, @Req() req: RequestWithUser) {
    return await this.largeFileUploadService.init(body, req)
  }

  @Throttle({ default: { limit: 10000, ttl: 60000 } })
  @Put(':id/chunks/:index')
  async putChunk(
    @Req() req: RequestWithUser,
    @Param('index', ParseIntPipe) index: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const content_length = Number(req.headers['content-length']) || 0
    const chunk_sha256 = req.headers['chunk-sha256'] as string
    return await this.largeFileUploadService.writeChunk(
      id,
      index,
      chunk_sha256,
      req,
      content_length,
    )
  }

  @Get(':id/status')
  async getStatus(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return await this.largeFileUploadService.status(id, req)
  }

  @Patch(':id/complete')
  async complete(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return await this.largeFileUploadService.complete(id, req)
  }

  @Delete(':id')
  async abort(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return await this.largeFileUploadService.abort(id, req)
  }
}
