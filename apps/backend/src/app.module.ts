import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { I18nModule, AcceptLanguageResolver, QueryResolver, CookieResolver } from 'nestjs-i18n'
import { PrismaModule } from './prisma.module'
import { CacheModule } from '@nestjs/cache-manager'
import { ThrottleModule } from './modules/throttle/throttle.module'
import { redisStore } from 'cache-manager-redis-yet'
import { KeyvAdapter } from 'cache-manager'
import { AuthModule } from './modules/auth/auth.module'
import { OptionalJwtAuthGuard } from './modules/auth/guards/optional-jwt-auth.guard'
import { ShionConfigModule } from './common/config/config.module'
import { ShionConfigService } from './common/config/services/config.service'
import { join } from 'path'

import { CacheUtilModule } from './modules/cache/cache-util.module'
import { UserModule } from './modules/user/user.module'
import { BangumiModule } from './modules/bangumi/bangumi.module'
import { VNDBModule } from './modules/vndb/vnbd.module'
import { GameModule } from './modules/game/game.module'
import { EmailModule } from './modules/email/email.module'
import { UploadModule } from './modules/upload/upload.module'
import { SecurityModule } from './modules/security/security.module'
import { ImageModule } from './modules/image/image.module'
import { ScheduleModule } from '@nestjs/schedule'
import { BullModule } from './modules/bull/bull.module'
import { S3Module } from './modules/s3/s3.module'
import { B2Module } from './modules/b2/b2.module'
import { EditModule } from './modules/edit/edit.module'
import { CommentModule } from './modules/comment/comment.module'
import { RenderModule } from './modules/render/render.module'
import { DeveloperModule } from './modules/developer/developer.module'
import { CharacterModule } from './modules/character/character.module'
import { SearchModule } from './modules/search/search.module'
import { ActivityModule } from './modules/activity/activity.module'
import { SiteModule } from './modules/site/site.module'
import { MessageModule } from './modules/message/message.module'
import { DatabaseModule } from './modules/database/database.module'
import { LLMsModule } from './modules/llms/llms.module'
import { ModerateModule } from './modules/moderate/moderate.module'
import { AdminModule } from './modules/admin/admin.module'
import { FavoriteModule } from './modules/favorite/favorite.module'
import { AnalysisModule } from './modules/analysis/analysis.module'

@Module({
  imports: [
    ShionConfigModule,
    PrismaModule,
    ScheduleModule.forRoot(),
    BullModule,
    LLMsModule,
    ModerateModule,
    S3Module,
    B2Module,
    ThrottleModule,
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ShionConfigService],
      useFactory: async (configService: ShionConfigService) => {
        const host = configService.get('redis.host')
        const port = configService.get('redis.port')
        const password = configService.get('redis.password')
        const keyPrefix = configService.get('redis.keyPrefix')
        const database = configService.get('redis.database')

        return {
          stores: [
            new KeyvAdapter(
              await redisStore({
                socket: { host, port },
                password: password || undefined,
                keyPrefix,
                database,
              }),
            ),
          ],
        }
      },
    }),
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: join(process.cwd(), 'i18n'),
        watch: true,
      },
      typesOutputPath: join(process.cwd(), 'src/generated/i18n.generated.ts'),
      resolvers: [
        new CookieResolver(['shionlib_locale']),
        { use: QueryResolver, options: ['lang'] },
        new AcceptLanguageResolver(),
      ],
    }),
    CacheUtilModule,
    AuthModule,
    UserModule,
    BangumiModule,
    VNDBModule,
    GameModule,
    EmailModule,
    UploadModule,
    SecurityModule,
    ImageModule,
    EditModule,
    CommentModule,
    RenderModule,
    DeveloperModule,
    CharacterModule,
    SearchModule,
    ActivityModule,
    SiteModule,
    MessageModule,
    DatabaseModule,
    AdminModule,
    FavoriteModule,
    AnalysisModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: OptionalJwtAuthGuard,
    },
  ],
})
export class AppModule {}
