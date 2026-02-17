import { Module, Global } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'
import { BangumiAuthService } from './services/bangumi-auth.service'
import { BangumiController } from './controllers/bangumi.controller'

@Global()
@Module({
  imports: [HttpModule],
  providers: [BangumiAuthService],
  controllers: [BangumiController],
  exports: [BangumiAuthService],
})
export class BangumiModule {}
