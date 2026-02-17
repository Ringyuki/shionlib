import { Module } from '@nestjs/common'
import { AnalysisDataController } from './controllers/data.controller'
import { DataService } from './services/data.service'
import { HttpModule } from '@nestjs/axios'

@Module({
  controllers: [AnalysisDataController],
  providers: [DataService],
  imports: [HttpModule],
})
export class AnalysisModule {}
