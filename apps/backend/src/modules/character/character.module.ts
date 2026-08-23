import { Module, forwardRef } from '@nestjs/common'
import { CharacterEditService } from './services/character-edit.service'
import { CharacterService } from './services/character.service'
import { CharacterController } from './controllers/character.controller'
import { PrismaService } from '../../prisma.service'
import { ActivityModule } from '../activity/activity.module'
import { BangumiModule } from '../bangumi/bangumi.module'
import { HikarinagiModule } from '../hikarinagi/hikarinagi.module'

@Module({
  imports: [forwardRef(() => HikarinagiModule), ActivityModule, BangumiModule],
  providers: [CharacterEditService, CharacterService, PrismaService],
  controllers: [CharacterController],
})
export class CharacterModule {}
