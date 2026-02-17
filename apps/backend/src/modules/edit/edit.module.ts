import { Module, Global } from '@nestjs/common'
import { SeedService } from './services/seed.service'
import { PermissionService } from './services/permission.service'
import { PermissionController } from './controllers/permission.controller'
import { EditController } from './controllers/edit.controller'
import { DataService } from './services/data.service'
import { UndoController } from './controllers/undo.controller'
import { UndoService } from './services/undo.service'

@Global()
@Module({
  controllers: [PermissionController, EditController, UndoController],
  providers: [SeedService, PermissionService, DataService, UndoService],
  exports: [SeedService, PermissionService],
})
export class EditModule {}
