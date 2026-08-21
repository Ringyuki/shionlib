import { forwardRef, Module } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'
import { GameModule } from '../game/game.module'
import { HikarinagiClient } from './clients/hikarinagi.client'
import { MirrorModeGuard } from './guards/mirror-mode.guard'
import { HikarinagiChangesService } from './services/hikarinagi-changes.service'
import { HikarinagiMappingService } from './services/hikarinagi-mapping.service'
import { HikarinagiChangesSyncTask } from './tasks/hikarinagi-changes-sync.task'
import { HikarinagiMappingSyncTask } from './tasks/hikarinagi-mapping-sync.task'

@Module({
  imports: [HttpModule, forwardRef(() => GameModule)],
  providers: [
    HikarinagiClient,
    HikarinagiMappingService,
    HikarinagiChangesService,
    HikarinagiMappingSyncTask,
    HikarinagiChangesSyncTask,
    MirrorModeGuard,
  ],
  exports: [HikarinagiClient, HikarinagiMappingService, HikarinagiChangesService, MirrorModeGuard],
})
export class HikarinagiModule {}
