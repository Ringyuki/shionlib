import { Module, Global } from '@nestjs/common'
import { ActivityController } from './controllers/activity.controller'
import { ActivityService } from './services/activity.service'

@Global()
@Module({
  controllers: [ActivityController],
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}
