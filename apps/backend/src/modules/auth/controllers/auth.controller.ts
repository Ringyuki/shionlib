import { Controller, Post, Req, Res, HttpCode, Body } from '@nestjs/common'
import { Response } from 'express'
import { UserService } from '../../user/services/user.service'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { LoginSessionService } from '../services/login-session.service'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { ForgetPasswordReqDto } from '../dto/req/forget-password.req.dto'
import { PasswordService } from '../services/password.service'
import { CheckForgetPasswordReqDto } from '../dto/req/check.req.dto'
import { ResetPasswordReqDto } from '../dto/req/reset-password.req.dto'
import { AuthSessionResDto } from '../dto/res/auth-session.res.dto'
import {
  buildAuthSessionResponse,
  clearAuthCookies,
  setAuthCookies,
} from '../helpers/auth-session-response.helper'

@Controller('auth')
export class AuthController {
  constructor(
    private readonly userService: UserService,
    private readonly loginSessionService: LoginSessionService,
    private readonly configService: ShionConfigService,
    private readonly passwordService: PasswordService,
  ) {}

  @Post('token/refresh')
  async refreshToken(
    @Req() request: RequestWithUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionResDto> {
    const authSession = await this.userService.refreshToken(
      request.cookies['shionlib_refresh_token'],
      request,
    )

    setAuthCookies(response, this.configService, authSession)
    return buildAuthSessionResponse(authSession)
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() request: RequestWithUser, @Res({ passthrough: true }) response: Response) {
    await this.loginSessionService.logout(request.cookies['shionlib_refresh_token'])

    clearAuthCookies(response)
  }

  @Post('password/forget')
  async forgetPassword(@Body() dto: ForgetPasswordReqDto) {
    return this.passwordService.getEmail(dto)
  }

  @Post('password/forget/check')
  async checkForgetPassword(@Body() dto: CheckForgetPasswordReqDto) {
    return this.passwordService.check(dto)
  }

  @Post('password/forget/reset')
  async resetPassword(@Body() dto: ResetPasswordReqDto) {
    return this.passwordService.resetPassword(dto)
  }
}
