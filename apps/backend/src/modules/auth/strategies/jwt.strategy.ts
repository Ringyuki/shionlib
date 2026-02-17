import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ShionConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: RequestWithUser) => req?.cookies?.['shionlib_access_token'],
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get('token.secret'),
    })
  }
  async validate(payload: RequestWithUser['user']) {
    return payload
  }
}
