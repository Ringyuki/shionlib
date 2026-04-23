import { Module } from '@nestjs/common'
import { CharacterEditService } from './services/character-edit.service'
import { CharacterService } from './services/character.service'
import { CharacterEditController } from './controllers/character-edit.controller'
import { CharacterController } from './controllers/character.controller'
import { PrismaService } from '../../prisma.service'
import { ActivityModule } from '../activity/activity.module'
import { BangumiModule } from '../bangumi/bangumi.module'
import { CharacterFieldSyncService } from './services/character-field-sync.service'

@Module({
  imports: [ActivityModule, BangumiModule],
  providers: [CharacterEditService, CharacterService, CharacterFieldSyncService, PrismaService],
  controllers: [CharacterEditController, CharacterController],
})
export class CharacterModule {}
