import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { FileCleanService } from '../services/file-clean.service'

@Injectable()
export class FileCleanTask {
  constructor(private readonly fileCleanService: FileCleanService) {}
  private readonly logger = new Logger(FileCleanTask.name)

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    try {
      await this.fileCleanService.clean()
    } catch (error) {
      this.logger.error('Error cleaning files', error)
    }
  }
}
