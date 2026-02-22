import { Module } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'
import { PotatoVNBindingController } from './controllers/potatovn-binding.controller'
import { PotatoVNGameMappingController } from './controllers/potatovn-game-mapping.controller'
import { PotatoVNBindingService } from './services/potatovn-binding.service'
import { PotatoVNGameMappingService } from './services/potatovn-game-mapping.service'
import { PvnTokenRefreshTask } from './tasks/pvn-token-refresh.task'
import { PvnDataSyncTask } from './tasks/pvn-data-sync.task'
import { CleanExpiresTask } from './tasks/clean-expires.task'

@Module({
  imports: [HttpModule],
  controllers: [PotatoVNBindingController, PotatoVNGameMappingController],
  providers: [
    PotatoVNBindingService,
    PotatoVNGameMappingService,
    PvnTokenRefreshTask,
    PvnDataSyncTask,
    CleanExpiresTask,
  ],
  exports: [PotatoVNBindingService, PotatoVNGameMappingService],
})
export class PotatoVNModule {}
