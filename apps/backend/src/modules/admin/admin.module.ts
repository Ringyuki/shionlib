import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { ModerateModule } from '../moderate/moderate.module'
import { AdminStatsController } from './controllers/admin-stats.controller'
import { AdminContentController } from './controllers/admin-content.controller'
import { AdminUserController } from './controllers/admin-user.controller'
import { AdminCommentController } from './controllers/admin-comment.controller'
import { AdminStatsService } from './services/admin-stats.service'
import { AdminContentService } from './services/admin-content.service'
import { AdminUserService } from './services/admin-user.service'
import { AdminCommentService } from './services/admin-comment.service'
import { AdminGameService } from './services/admin-game.service'
import { GameModule } from '../game/game.module'
import { SecurityModule } from '../security/security.module'

@Module({
  imports: [AuthModule, ModerateModule, GameModule, SecurityModule],
  controllers: [
    AdminStatsController,
    AdminContentController,
    AdminUserController,
    AdminCommentController,
  ],
  providers: [
    AdminStatsService,
    AdminContentService,
    AdminUserService,
    AdminCommentService,
    AdminGameService,
  ],
  exports: [
    AdminStatsService,
    AdminContentService,
    AdminUserService,
    AdminCommentService,
    AdminGameService,
  ],
})
export class AdminModule {}
