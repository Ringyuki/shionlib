import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import { Response } from 'express'
import { JwtAuthGuard } from '../guards/jwt-auth.guard'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { PasskeyService } from '../services/passkey.service'
import { PasskeyRegisterOptionsReqDto } from '../dto/req/passkey-register-options.req.dto'
import { PasskeyRegisterVerifyReqDto } from '../dto/req/passkey-register-verify.req.dto'
import { PasskeyLoginOptionsReqDto } from '../dto/req/passkey-login-options.req.dto'
import { PasskeyLoginVerifyReqDto } from '../dto/req/passkey-login-verify.req.dto'
import { ShionConfigService } from '../../../common/config/services/config.service'

@Controller('auth/passkey')
export class PasskeyController {
  constructor(
    private readonly passkeyService: PasskeyService,
    private readonly configService: ShionConfigService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('register/options')
  async createRegisterOptions(
    @Req() req: RequestWithUser,
    @Body() dto: PasskeyRegisterOptionsReqDto,
  ) {
    return this.passkeyService.createRegisterOptions(req, dto.name)
  }

  @UseGuards(JwtAuthGuard)
  @Post('register/verify')
  async verifyRegister(@Req() req: RequestWithUser, @Body() dto: PasskeyRegisterVerifyReqDto) {
    return this.passkeyService.verifyRegister(req, dto.flow_id, dto.response as any, dto.name)
  }

  @Post('login/options')
  async createLoginOptions(@Body() dto: PasskeyLoginOptionsReqDto) {
    return this.passkeyService.createLoginOptions(dto.identifier)
  }

  @Post('login/verify')
  async verifyLogin(
    @Req() req: RequestWithUser,
    @Body() dto: PasskeyLoginVerifyReqDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { token, refresh_token, tokenExp } = await this.passkeyService.verifyLogin(
      dto.flow_id,
      dto.response,
      req,
    )
    response.setHeader('Set-Cookie', [
      `shionlib_access_token=${token}; HttpOnly; Secure ; SameSite=Lax; Path=/; Max-Age=${this.configService.get('token.expiresIn')}`,
      `shionlib_refresh_token=${refresh_token}; HttpOnly; Secure ; SameSite=Lax; Path=/; Max-Age=${this.configService.get('refresh_token.shortWindowSec')}`,
    ])

    return { accessTokenExp: tokenExp ? new Date(tokenExp).getTime() : null }
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async list(@Req() req: RequestWithUser) {
    return this.passkeyService.listMyPasskeys(req.user.sub)
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Req() req: RequestWithUser, @Param('id', ParseIntPipe) id: number) {
    return this.passkeyService.revokeMyPasskey(req.user.sub, id)
  }
}
