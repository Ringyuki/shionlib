import { Injectable } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { HikarinagiChangesService } from '../services/hikarinagi-changes.service'

@Injectable()
export class HikarinagiChangesSyncTask {
  constructor(
    private readonly changesService: HikarinagiChangesService,
    private readonly configService: ShionConfigService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleCron() {
    if (!this.configService.get('hikarinagi.sync.enabled')) return
    await this.changesService.consume()
  }
}
