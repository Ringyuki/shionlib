import { Module } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'
import { HikarinagiClient } from './clients/hikarinagi.client'
import { HikarinagiMappingService } from './services/hikarinagi-mapping.service'
import { HikarinagiMappingSyncTask } from './tasks/hikarinagi-mapping-sync.task'

@Module({
  imports: [HttpModule],
  providers: [HikarinagiClient, HikarinagiMappingService, HikarinagiMappingSyncTask],
  exports: [HikarinagiMappingService],
})
export class HikarinagiModule {}
