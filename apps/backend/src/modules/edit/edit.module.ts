import { Module, Global, forwardRef } from '@nestjs/common'
import { SeedService } from './services/seed.service'
import { PermissionService } from './services/permission.service'
import { DataService } from './services/data.service'
import { UndoService } from './services/undo.service'
import { GameModule } from '../game/game.module'

@Global()
@Module({
  imports: [forwardRef(() => GameModule)],
  providers: [SeedService, PermissionService, DataService, UndoService],
  exports: [SeedService, PermissionService],
})
export class EditModule {}
