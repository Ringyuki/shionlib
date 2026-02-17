import { Module } from '@nestjs/common'
import { CharacterEditService } from './services/character-edit.service'
import { CharacterService } from './services/character.service'
import { CharacterEditController } from './controllers/character-edit.controller'
import { CharacterController } from './controllers/character.controller'
import { PrismaService } from '../../prisma.service'
import { ActivityModule } from '../activity/activity.module'

@Module({
  imports: [ActivityModule],
  providers: [CharacterEditService, CharacterService, PrismaService],
  controllers: [CharacterEditController, CharacterController],
})
export class CharacterModule {}
