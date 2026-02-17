import { Module } from '@nestjs/common'
import { FileScanService } from './services/file-scan.service'
import { FileScanTask } from './tasks/file-scan.task'
import { BullModule } from '@nestjs/bull'
import { LARGE_FILE_UPLOAD_QUEUE } from '../upload/constants/upload.constants'
import { UploadQuotaService } from '../upload/services/upload-quota.service'
import { UserModule } from '../user/user.module'
import { MalwareScanCaseService } from './services/malware-scan-case.service'

@Module({
  providers: [FileScanService, FileScanTask, UploadQuotaService, MalwareScanCaseService],
  imports: [BullModule.registerQueue({ name: LARGE_FILE_UPLOAD_QUEUE }), UserModule],
  exports: [MalwareScanCaseService],
})
export class SecurityModule {}
