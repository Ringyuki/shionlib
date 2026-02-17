import { Injectable, Logger } from '@nestjs/common'
import { BackupService } from '../services/backup.service'
import { Cron, CronExpression } from '@nestjs/schedule'

@Injectable()
export class BackupTask {
  private readonly logger = new Logger(BackupTask.name)
  constructor(private readonly backupService: BackupService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCron() {
    try {
      this.logger.log('Starting database backup')
      await this.backupService.backupToS3()
    } catch (error) {
      this.logger.error('Error running database backup', error)
    }
  }
}
