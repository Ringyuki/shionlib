import { Module } from '@nestjs/common'
import { ModerationProcessor } from './queues/moderation.processor'
import { MODERATION_QUEUE } from './constants/moderation.constants'
import { BullModule } from '@nestjs/bull'

const ModerationQueueModule = BullModule.registerQueue({ name: MODERATION_QUEUE })

@Module({
  providers: [ModerationProcessor],
  exports: [ModerationQueueModule],
  imports: [ModerationQueueModule],
})
export class ModerateModule {}
