import { Module } from '@nestjs/common'
import { WalkthroughService } from './services/walkthrough.service'
import { WalkthroughController } from './controllers/walkthrough.controller'
import { RenderModule } from '../render/render.module'
import { ModerateModule } from '../moderate/moderate.module'

@Module({
  imports: [RenderModule, ModerateModule],
  controllers: [WalkthroughController],
  providers: [WalkthroughService],
})
export class WalkthroughModule {}
