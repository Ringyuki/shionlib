import { Module } from '@nestjs/common'
import { BackupTask } from './tasks/backup.task'
import { BackupService } from './services/backup.service'
import { S3Module } from '../s3/s3.module'

@Module({
  imports: [S3Module],
  providers: [BackupTask, BackupService],
  exports: [BackupTask, BackupService],
})
export class DatabaseModule {}
