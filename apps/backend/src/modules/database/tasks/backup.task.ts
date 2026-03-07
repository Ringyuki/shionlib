import { Injectable, Logger } from '@nestjs/common'
import { BackupService } from '../services/backup.service'
import { Cron } from '@nestjs/schedule'

@Injectable()
export class BackupTask {
  private readonly logger = new Logger(BackupTask.name)
  constructor(private readonly backupService: BackupService) {}

  @Cron('0 2 * * *') // Every day at 02:00
  async handleDailyCron() {
    try {
      this.logger.log('Starting daily database backup')
      await this.backupService.backupToS3('daily')
    } catch (error) {
      this.logger.error('Error running daily database backup', error)
    }
  }

  @Cron('0 3 * * 0') // Every Sunday at 03:00
  async handleWeeklyCron() {
    try {
      this.logger.log('Starting weekly database backup')
      await this.backupService.backupToS3('weekly')
    } catch (error) {
      this.logger.error('Error running weekly database backup', error)
    }
  }
}
