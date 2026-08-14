import { Module } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'
import { GameModule } from '../game/game.module'
import { HikarinagiClient } from './clients/hikarinagi.client'
import { HikarinagiOpenClient } from './clients/hikarinagi-open.client'
import { HikarinagiChangesService } from './services/hikarinagi-changes.service'
import { HikarinagiMappingService } from './services/hikarinagi-mapping.service'
import { HikarinagiSyncService } from './services/hikarinagi-sync.service'
import { HikarinagiTokenService } from './services/hikarinagi-token.service'
import { HikarinagiChangesSyncTask } from './tasks/hikarinagi-changes-sync.task'
import { HikarinagiMappingSyncTask } from './tasks/hikarinagi-mapping-sync.task'

@Module({
  imports: [HttpModule, GameModule],
  providers: [
    HikarinagiClient,
    HikarinagiOpenClient,
    HikarinagiTokenService,
    HikarinagiMappingService,
    HikarinagiSyncService,
    HikarinagiChangesService,
    HikarinagiMappingSyncTask,
    HikarinagiChangesSyncTask,
  ],
  exports: [HikarinagiMappingService, HikarinagiSyncService, HikarinagiChangesService],
})
export class HikarinagiModule {}
