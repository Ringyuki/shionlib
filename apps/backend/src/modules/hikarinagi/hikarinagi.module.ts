import { forwardRef, Module } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'
import { GameModule } from '../game/game.module'
import { HikarinagiClient } from './clients/hikarinagi.client'
import { MirrorModeGuard } from './guards/mirror-mode.guard'
import { HikarinagiCardService } from './services/hikarinagi-card.service'
import { HikarinagiChangesService } from './services/hikarinagi-changes.service'
import { HikarinagiMappingService } from './services/hikarinagi-mapping.service'
import { HikarinagiShellService } from './services/hikarinagi-shell.service'
import { HikarinagiChangesSyncTask } from './tasks/hikarinagi-changes-sync.task'

@Module({
  imports: [HttpModule, forwardRef(() => GameModule)],
  providers: [
    HikarinagiClient,
    HikarinagiCardService,
    HikarinagiMappingService,
    HikarinagiShellService,
    HikarinagiChangesService,
    HikarinagiChangesSyncTask,
    MirrorModeGuard,
  ],
  exports: [
    HikarinagiClient,
    HikarinagiCardService,
    HikarinagiMappingService,
    HikarinagiShellService,
    HikarinagiChangesService,
    MirrorModeGuard,
  ],
})
export class HikarinagiModule {}
