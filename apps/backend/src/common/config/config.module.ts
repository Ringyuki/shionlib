import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import configs from './configs'
import { ShionConfigService } from './services/config.service'

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: configs,
    }),
  ],
  providers: [ShionConfigService],
  exports: [ShionConfigService],
})
export class ShionConfigModule {}
