import { Injectable } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { HikarinagiMappingService } from '../services/hikarinagi-mapping.service'

@Injectable()
export class HikarinagiMappingSyncTask {
  constructor(private readonly hikarinagiMappingService: HikarinagiMappingService) {}

  @Cron(CronExpression.EVERY_6_HOURS)
  async handle() {
    await this.hikarinagiMappingService.syncMapping()
  }
}
