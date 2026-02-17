import { Global, Module } from '@nestjs/common'
import { ImageProcessService } from './services/image-process.service'
import { ImageUploadService } from './services/image-upload.service'
import { ImageUploadTask } from './tasks/image-upload.task'
import { SmallFileUploadService } from '../upload/services/small-file-upload.service'

@Global()
@Module({
  providers: [ImageProcessService, ImageUploadService, ImageUploadTask, SmallFileUploadService],
  exports: [ImageProcessService, ImageUploadService],
})
export class ImageModule {}
