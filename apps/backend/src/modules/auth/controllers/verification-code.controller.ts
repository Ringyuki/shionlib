import { Controller, Post, Body } from '@nestjs/common'
import { VerifyCodeDto } from '../dto/req/verify-code.req.dto'
import { RequestCodeDto } from '../dto/req/request-code.req.dto'
import { VerificationCodeService } from '../services/vrification-code.service'

@Controller('auth/code')
export class VerificationCodeController {
  constructor(private readonly verificationCodeService: VerificationCodeService) {}

  @Post('request')
  async request(@Body() request: RequestCodeDto) {
    return this.verificationCodeService.request(request.email)
  }

  @Post('verify')
  async verify(@Body() request: VerifyCodeDto) {
    return this.verificationCodeService.verify(request)
  }
}
