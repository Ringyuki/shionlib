import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { UserInfoService } from '../services/user-info.service'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { UpdateEmailReqDto } from '../dto/req/update-email.req.dto'
import { UpdateNameReqDto } from '../dto/req/update-name.req.dto'
import { UpdateCoverReqDto } from '../dto/req/update-cover.req.dto'
import { UpdatePasswordReqDto } from '../dto/req/update-password.req.dto'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'

@UseGuards(JwtAuthGuard)
@Controller('user/info')
export class UserInfoController {
  constructor(private readonly userInfoService: UserInfoService) {}

  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
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
  async updateAvatar(@UploadedFile() file: Express.Multer.File, @Req() request: RequestWithUser) {
    return await this.userInfoService.updateAvatar(file, request.user.sub)
  }

  @Post('cover')
  async updateCover(@Body() dto: UpdateCoverReqDto, @Req() request: RequestWithUser) {
    return await this.userInfoService.updateCover(dto.cover, request.user.sub)
  }

  @Post('name')
  async updateName(@Body() dto: UpdateNameReqDto, @Req() request: RequestWithUser) {
    return await this.userInfoService.updateName(dto.name, request.user.sub)
  }

  @Post('email/request')
  async requestCode(@Req() request: RequestWithUser) {
    return await this.userInfoService.requestCode(request.user.sub)
  }

  @Post('email')
  async updateEmail(@Body() dto: UpdateEmailReqDto, @Req() request: RequestWithUser) {
    return await this.userInfoService.updateEmail(dto, request.user.sub)
  }

  @Post('password')
  async updatePassword(@Body() dto: UpdatePasswordReqDto, @Req() request: RequestWithUser) {
    return await this.userInfoService.updatePassword(
      dto.password,
      dto.old_password,
      request.user.sub,
    )
  }

  @Post('lang')
  async updateLang(@Body() body: { lang: string }, @Req() request: RequestWithUser) {
    return await this.userInfoService.updateLang(body.lang, request.user.sub)
  }

  @Post('content-limit')
  async updateContentLimit(
    @Body() body: { content_limit: number },
    @Req() request: RequestWithUser,
  ) {
    return await this.userInfoService.updateContentLimit(body.content_limit, request.user.sub)
  }
}
