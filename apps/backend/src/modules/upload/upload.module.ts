import { Module, Global } from '@nestjs/common'
import { LargeFileUploadController } from './controllers/large-file-upload.controller'
import { LargeFileUploadService } from './services/large-file-upload.service'
import { SmallFileUploadController } from './controllers/small-file-upload.controller'
import { SmallFileUploadService } from './services/small-file-upload.service'
import { S3Module } from '../s3/s3.module'
import { UploadProcessor } from './queues/upload.processor'
import { LARGE_FILE_UPLOAD_QUEUE } from './constants/upload.constants'
import { BullModule } from '@nestjs/bull'
import { UploadQuotaService } from './services/upload-quota.service'
import { UploadQuotaController } from './controllers/upload-quota.controller'
import { FileCleanService } from './services/file-clean.service'
import { FileCleanTask } from './tasks/file-clean.task'
import { UploadQuotaTask } from './tasks/upload-quota.task'
import { HashWorkerService } from './services/hash-worker.service'

@Global()
@Module({
  controllers: [LargeFileUploadController, SmallFileUploadController, UploadQuotaController],
  providers: [
    LargeFileUploadService,
    SmallFileUploadService,
    UploadProcessor,
    UploadQuotaService,
    FileCleanService,
    FileCleanTask,
    UploadQuotaTask,
    HashWorkerService,
  ],
  imports: [S3Module, BullModule.registerQueue({ name: LARGE_FILE_UPLOAD_QUEUE })],
  exports: [BullModule, SmallFileUploadService, UploadQuotaService],
})
export class UploadModule {}
