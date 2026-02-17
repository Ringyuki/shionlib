import { Module } from '@nestjs/common'
import { UserController } from './controllers/user.controller'
import { UserService } from './services/user.service'
import { LoginSessionService } from '../auth/services/login-session.service'
import { TokenService } from '../auth/services/token.service'
import { AuthModule } from '../auth/auth.module'
import { VerificationCodeService } from '../auth/services/vrification-code.service'
import { UserInfoController } from './controllers/user-info.controller'
import { UserInfoService } from './services/user-info.service'
import { UserDataController } from './controllers/user-data.controller'
import { UserDataService } from './services/user-data.service'
import { UnbanUserTask } from './tasks/unban-user.task'

@Module({
  controllers: [UserController, UserInfoController, UserDataController],
  providers: [
    UserService,
    LoginSessionService,
    TokenService,
    VerificationCodeService,
    UserInfoService,
    UserDataService,
    UnbanUserTask,
  ],
  imports: [AuthModule],
  exports: [UserService],
})
export class UserModule {}
