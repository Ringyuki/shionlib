import { Module } from '@nestjs/common'
import { BullModule as BullModuleBase } from '@nestjs/bull'
import { ShionConfigService } from '../../common/config/services/config.service'

@Module({
  imports: [
    BullModuleBase.forRootAsync({
      inject: [ShionConfigService],
      useFactory: (configService: ShionConfigService) => ({
        redis: {
          host: configService.get('redis.host'),
          port: configService.get('redis.port'),
          password: configService.get('redis.password'),
          keyPrefix: configService.get('redis.keyPrefix'),
          db: configService.get('redis.database'),
        },
        defaultJobOptions: {
          removeOnComplete: true,
        },
      }),
    }),
  ],
})
export class BullModule {}
