import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { FileScanService } from '../services/file-scan.service'

@Injectable()
export class FileScanTask {
  private readonly logger = new Logger(FileScanTask.name)
  constructor(private readonly fileScanService: FileScanService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    try {
      const [count, expiredProcessed] = await Promise.all([
        this.fileScanService.scanFiles(),
        this.fileScanService.processExpiredMalwareCases(),
      ])
      if (count > 0) {
        this.logger.log(`${count} files scanned successfully`)
      }
      if (expiredProcessed > 0) {
        this.logger.log(`${expiredProcessed} expired malware cases auto-processed`)
      }
    } catch (error) {
      this.logger.error('Error scanning files', error)
    }
  }
}
