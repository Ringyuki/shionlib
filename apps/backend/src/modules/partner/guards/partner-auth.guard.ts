import { Injectable, CanActivate, ExecutionContext, HttpStatus } from '@nestjs/common'
import { timingSafeEqual } from 'crypto'
import { Request } from 'express'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { ShionConfigService } from '../../../common/config/services/config.service'

export const PARTNER_SECRET_HEADER = 'x-partner-secret'

@Injectable()
export class PartnerAuthGuard implements CanActivate {
  constructor(private readonly configService: ShionConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.configService.get('partner.secret')
    const provided = context.switchToHttp().getRequest<Request>().headers[PARTNER_SECRET_HEADER]

    if (!secret || typeof provided !== 'string' || !this.matches(provided, secret)) {
      throw new ShionBizException(
        ShionBizCode.PARTNER_UNAUTHORIZED,
        'shion-biz.PARTNER_UNAUTHORIZED',
        undefined,
        HttpStatus.UNAUTHORIZED,
      )
    }

    return true
  }

  private matches(provided: string, secret: string): boolean {
    const a = Buffer.from(provided)
    const b = Buffer.from(secret)

    return a.length === b.length && timingSafeEqual(a, b)
  }
}
