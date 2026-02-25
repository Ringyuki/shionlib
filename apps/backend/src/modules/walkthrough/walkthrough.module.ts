import { Module } from '@nestjs/common'
import { WalkthroughService } from './services/walkthrough.service'
import { WalkthroughController } from './controllers/walkthrough.controller'
import { RenderModule } from '../render/render.module'

@Module({
  imports: [RenderModule],
  controllers: [WalkthroughController],
  providers: [WalkthroughService],
})
export class WalkthroughModule {}
