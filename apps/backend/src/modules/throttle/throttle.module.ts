import { ThrottlerGuard, ThrottlerModule, ThrottlerModuleOptions } from '@nestjs/throttler'
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis'
import { Redis } from 'ioredis'
import { Module } from '@nestjs/common'
import { ShionConfigService } from '../../common/config/services/config.service'
import { APP_GUARD } from '@nestjs/core'

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [ShionConfigService, Redis],
      useFactory: (configService: ShionConfigService, redis: Redis): ThrottlerModuleOptions => ({
        throttlers: [
          {
            ttl: configService.get('throttle.ttl'),
            limit: configService.get('throttle.limit'),
            blockDuration: configService.get('throttle.blockDuration'),
            getTracker: req =>
              req.headers['x-real-ip'] ||
              req.headers['cf-connecting-ip'] ||
              req.headers['x-forwarded-for']?.split(',')[0].trim(),
          },
          {
            name: 'download',
            ttl: configService.get('throttle.download.ttl'),
            limit: configService.get('throttle.download.limit'),
            blockDuration: configService.get('throttle.download.blockDuration'),
            skipIf: ctx => !ctx.switchToHttp().getRequest().path.startsWith('/game/download'),
          },
        ],
        storage: new ThrottlerStorageRedisService(redis),
      }),
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [ThrottlerModule],
})
export class ThrottleModule {}
