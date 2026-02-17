import { Module } from '@nestjs/common'
import { DeveloperService } from './services/developer.service'
import { DeveloperEditService } from './services/developer-edit.service'
import { DeveloperController } from './controllers/developer.controller'
import { DeveloperEditController } from './controllers/developer-edit.controller'
import { PrismaService } from '../../prisma.service'
import { ActivityModule } from '../activity/activity.module'

@Module({
  imports: [ActivityModule],
  providers: [DeveloperService, DeveloperEditService, PrismaService],
  controllers: [DeveloperController, DeveloperEditController],
})
export class DeveloperModule {}
