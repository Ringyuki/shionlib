import { Global, Module } from '@nestjs/common'
import { CacheService } from './services/cache.service'
import { Redis } from 'ioredis'
import { ShionConfigService } from '../../common/config/services/config.service'

@Global()
@Module({
  providers: [
    CacheService,
    {
      provide: Redis,
      inject: [ShionConfigService],
      useFactory: (configService: ShionConfigService) =>
        new Redis({
          host: configService.get('redis.host'),
          port: configService.get('redis.port'),
          password: configService.get('redis.password'),
          keyPrefix: configService.get('redis.keyPrefix'),
          db: configService.get('redis.database'),
        }),
    },
  ],
  exports: [CacheService, Redis],
})
export class CacheUtilModule {}
