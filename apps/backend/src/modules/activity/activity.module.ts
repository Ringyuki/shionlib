import { Module, Global, forwardRef } from '@nestjs/common'
import { ActivityController } from './controllers/activity.controller'
import { ActivityService } from './services/activity.service'
import { HikarinagiModule } from '../hikarinagi/hikarinagi.module'

@Global()
@Module({
  imports: [forwardRef(() => HikarinagiModule)],
  controllers: [ActivityController],
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}
