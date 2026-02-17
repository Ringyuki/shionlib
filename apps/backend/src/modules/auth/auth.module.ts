import { Global, Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { RolesGuard } from './guards/roles.guard'
import { JwtStrategy } from './strategies/jwt.strategy'
import { ShionConfigService } from '../../common/config/services/config.service'
import { LoginSessionService } from './services/login-session.service'
import { TokenService } from './services/token.service'
import { AuthController } from './controllers/auth.controller'
import { UserService } from '../user/services/user.service'
import { VerificationCodeService } from './services/vrification-code.service'
import { VerificationCodeController } from './controllers/verification-code.controller'
import { PasswordService } from './services/password.service'

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ShionConfigService],
      useFactory: (configService: ShionConfigService) => ({
        secret: configService.get('token.secret'),
        signOptions: { expiresIn: Number(configService.get('token.expiresIn')) * 1000 },
      }),
    }),
    PassportModule.register({
      defaultStrategy: 'jwt',
    }),
  ],
  providers: [
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    LoginSessionService,
    TokenService,
    UserService,
    VerificationCodeService,
    PasswordService,
  ],
  controllers: [AuthController, VerificationCodeController],
  exports: [JwtModule, PassportModule, LoginSessionService, UserService],
})
export class AuthModule {}
