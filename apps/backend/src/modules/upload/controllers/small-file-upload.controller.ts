import {
  Controller,
  Put,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Param,
  ParseIntPipe,
  Req,
} from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import type { Express } from 'express'
import { SmallFileUploadService } from '../services/small-file-upload.service'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { SMALL_FILE_UPLOAD_FILE_SIZE_HARD_LIMIT } from '../constants/upload.constants'

@UseGuards(JwtAuthGuard)
@Controller('uploads/small')
export class SmallFileUploadController {
  constructor(private readonly smallFileUploadService: SmallFileUploadService) {}

  @Put('game/:game_id/cover')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: SMALL_FILE_UPLOAD_FILE_SIZE_HARD_LIMIT },
      fileFilter: (_req, file, cb) => {
        const ok = /^image\/(jpeg|png|webp|avif)$/.test(file.mimetype)
        cb(
          ok
            ? null
            : new ShionBizException(
                ShionBizCode.SMALL_FILE_UPLOAD_UNSUPPORTED_FILE_TYPE,
                'shion-biz.SMALL_FILE_UPLOAD_UNSUPPORTED_FILE_TYPE',
              ),
          ok,
        )
      },
    }),
  )
  async uploadGameCover(
    @Param('game_id', ParseIntPipe) game_id: number,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: RequestWithUser,
  ) {
    return await this.smallFileUploadService.uploadGameCover(game_id, file, req)
  }

  @Put('game/:game_id/image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: SMALL_FILE_UPLOAD_FILE_SIZE_HARD_LIMIT },
      fileFilter: (_req, file, cb) => {
        const ok = /^image\/(jpeg|png|webp|avif)$/.test(file.mimetype)
        cb(
          ok
            ? null
            : new ShionBizException(
                ShionBizCode.SMALL_FILE_UPLOAD_UNSUPPORTED_FILE_TYPE,
                'shion-biz.SMALL_FILE_UPLOAD_UNSUPPORTED_FILE_TYPE',
              ),
          ok,
        )
      },
    }),
  )
  async uploadGameImage(
    @Param('game_id', ParseIntPipe) game_id: number,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: RequestWithUser,
  ) {
    return await this.smallFileUploadService.uploadGameImage(game_id, file, req)
  }

  @Put('developer/:developer_id/logo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: SMALL_FILE_UPLOAD_FILE_SIZE_HARD_LIMIT },
      fileFilter: (_req, file, cb) => {
        const ok = /^image\/(jpeg|png|webp|avif)$/.test(file.mimetype)
        cb(
          ok
            ? null
            : new ShionBizException(
                ShionBizCode.SMALL_FILE_UPLOAD_UNSUPPORTED_FILE_TYPE,
                'shion-biz.SMALL_FILE_UPLOAD_UNSUPPORTED_FILE_TYPE',
              ),
          ok,
        )
      },
    }),
  )
  async uploadDeveloperLogo(
    @Param('developer_id', ParseIntPipe) developer_id: number,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: RequestWithUser,
  ) {
    return await this.smallFileUploadService.uploadDeveloperLogo(developer_id, file, req)
  }

  @Put('character/:character_id/image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: SMALL_FILE_UPLOAD_FILE_SIZE_HARD_LIMIT },
      fileFilter: (_req, file, cb) => {
        const ok = /^image\/(jpeg|png|webp|avif)$/.test(file.mimetype)
        cb(
          ok
            ? null
            : new ShionBizException(
                ShionBizCode.SMALL_FILE_UPLOAD_UNSUPPORTED_FILE_TYPE,
                'shion-biz.SMALL_FILE_UPLOAD_UNSUPPORTED_FILE_TYPE',
              ),
          ok,
        )
      },
    }),
  )
  async uploadCharacterImage(
    @Param('character_id', ParseIntPipe) character_id: number,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: RequestWithUser,
  ) {
    return await this.smallFileUploadService.uploadCharacterImage(character_id, file, req)
  }
}
