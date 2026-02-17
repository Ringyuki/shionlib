import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { TokenPayloadInterface } from '../interfaces/token-payload.interface'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ShionConfigService,
  ) {}
  async signToken(paylod: TokenPayloadInterface) {
    const expiresIn = Number(this.configService.get('token.expiresIn')) * 1000
    const secret = this.configService.get('token.secret')
    const token = await this.jwtService.signAsync(paylod, { expiresIn, secret })

    const decode = this.jwtService.decode(token) as { exp?: number }
    const exp = decode.exp ? new Date(decode.exp * 1000) : null

    return { token, exp }
  }

  verifyToken<T = TokenPayloadInterface>(token: string): T {
    try {
      return this.jwtService.verify(token, {
        secret: this.configService.get('token.secret'),
      }) as T
    } catch {
      throw new ShionBizException(ShionBizCode.AUTH_UNAUTHORIZED, 'shion-biz.AUTH_UNAUTHORIZED')
    }
  }
}
