import { Module, Global } from '@nestjs/common'
import { S3Client } from '@aws-sdk/client-s3'
import { ShionConfigService } from '../../common/config/services/config.service'
import { S3Service } from './services/s3.service'
import {
  GAME_STORAGE,
  IMAGE_STORAGE,
  BACKUP_STORAGE,
  S3_GAME_CLIENT,
  S3_IMAGE_CLIENT,
  S3_BACKUP_CLIENT,
} from './constants/s3.constants'
import { AdminTestController } from './controllers/admin-test.controller'

@Global()
@Module({
  controllers: [AdminTestController],
  providers: [
    {
      provide: S3_IMAGE_CLIENT,
      useFactory: (config: ShionConfigService) =>
        new S3Client({
          region: config.get('s3.image.region'),
          endpoint: config.get('s3.image.endpoint'),
          credentials: {
            accessKeyId: config.get('s3.image.accessKeyId'),
            secretAccessKey: config.get('s3.image.secretAccessKey'),
          },
        }),
      inject: [ShionConfigService],
    },
    {
      provide: S3_GAME_CLIENT,
      useFactory: (config: ShionConfigService) =>
        new S3Client({
          region: config.get('s3.game.region'),
          endpoint: config.get('s3.game.endpoint'),
          credentials: {
            accessKeyId: config.get('s3.game.accessKeyId'),
            secretAccessKey: config.get('s3.game.secretAccessKey'),
          },
        }),
      inject: [ShionConfigService],
    },
    {
      provide: S3_BACKUP_CLIENT,
      useFactory: (config: ShionConfigService) =>
        new S3Client({
          region: config.get('s3.backup.region'),
          endpoint: config.get('s3.backup.endpoint'),
          credentials: {
            accessKeyId: config.get('s3.backup.accessKeyId'),
            secretAccessKey: config.get('s3.backup.secretAccessKey'),
          },
        }),
      inject: [ShionConfigService],
    },
    {
      provide: IMAGE_STORAGE,
      useFactory: (client: S3Client, config: ShionConfigService) =>
        new S3Service(client, config.get('s3.image.bucket')),
      inject: [S3_IMAGE_CLIENT, ShionConfigService],
    },
    {
      provide: GAME_STORAGE,
      useFactory: (client: S3Client, config: ShionConfigService) =>
        new S3Service(client, config.get('s3.game.bucket')),
      inject: [S3_GAME_CLIENT, ShionConfigService],
    },
    {
      provide: BACKUP_STORAGE,
      useFactory: (client: S3Client, config: ShionConfigService) =>
        new S3Service(client, config.get('s3.backup.bucket')),
      inject: [S3_BACKUP_CLIENT, ShionConfigService],
    },
  ],
  exports: [IMAGE_STORAGE, GAME_STORAGE, BACKUP_STORAGE],
})
export class S3Module {}
