import { ThrottlerGuard, ThrottlerModule, ThrottlerModuleOptions } from '@nestjs/throttler'
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis'
import { Redis } from 'ioredis'
import { Module } from '@nestjs/common'
import { ShionConfigService } from '../../common/config/services/config.service'
import { APP_GUARD } from '@nestjs/core'
import { isGameDownloadLinkRoute } from './utils/is-game-download-link-route'
import { getThrottleTracker } from './utils/get-throttle-tracker'

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [ShionConfigService, Redis],
      useFactory: (configService: ShionConfigService, redis: Redis): ThrottlerModuleOptions => ({
        getTracker: req => getThrottleTracker(req),
        throttlers: [
          {
            ttl: configService.get('throttle.ttl'),
            limit: configService.get('throttle.limit'),
            blockDuration: configService.get('throttle.blockDuration'),
          },
          {
            name: 'download',
            ttl: configService.get('throttle.download.ttl'),
            limit: configService.get('throttle.download.limit'),
            blockDuration: configService.get('throttle.download.blockDuration'),
            skipIf: ctx => !isGameDownloadLinkRoute(ctx.switchToHttp().getRequest()),
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
