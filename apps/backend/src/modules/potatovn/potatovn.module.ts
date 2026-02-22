import { Module } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'
import { PotatoVNBindingController } from './controllers/potatovn-binding.controller'
import { PotatoVNBindingService } from './services/potatovn-binding.service'
import { PvnTokenRefreshTask } from './tasks/pvn-token-refresh.task'

@Module({
  imports: [HttpModule],
  controllers: [PotatoVNBindingController],
  providers: [PotatoVNBindingService, PvnTokenRefreshTask],
  exports: [PotatoVNBindingService],
})
export class PotatoVNModule {}
