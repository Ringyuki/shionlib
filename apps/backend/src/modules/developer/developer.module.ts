import { Module, forwardRef } from '@nestjs/common'
import { DeveloperService } from './services/developer.service'
import { DeveloperEditService } from './services/developer-edit.service'
import { DeveloperController } from './controllers/developer.controller'
import { PrismaService } from '../../prisma.service'
import { ActivityModule } from '../activity/activity.module'
import { BangumiModule } from '../bangumi/bangumi.module'
import { DeveloperFieldSyncService } from './services/developer-field-sync.service'
import { HikarinagiModule } from '../hikarinagi/hikarinagi.module'

@Module({
  imports: [forwardRef(() => HikarinagiModule), ActivityModule, BangumiModule],
  providers: [DeveloperService, DeveloperEditService, DeveloperFieldSyncService, PrismaService],
  controllers: [DeveloperController],
})
export class DeveloperModule {}
