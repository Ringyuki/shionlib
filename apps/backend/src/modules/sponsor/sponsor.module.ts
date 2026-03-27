import { Module } from '@nestjs/common'
import { HttpModule, HttpService } from '@nestjs/axios'
import { ShionConfigService } from '../../common/config/services/config.service'
import { SponsorController } from './controllers/sponsor.controller'
import { SponsorWebhookController } from './controllers/sponsor-webhook.controller'
import { SponsorAdminController } from './controllers/sponsor-admin.controller'
import { SponsorService } from './services/sponsor.service'
import { SponsorWallService } from './services/sponsor-wall.service'
import { IDataRiverPaymentProvider } from './providers/idatariver-payment.provider'
import { PAYMENT_PROVIDER } from './interfaces/payment-provider.interface'
import { OrderExpireTask } from './tasks/order-expire.task'

@Module({
  imports: [HttpModule],
  controllers: [SponsorController, SponsorWebhookController, SponsorAdminController],
  providers: [
    SponsorService,
    SponsorWallService,
    OrderExpireTask,
    {
      provide: PAYMENT_PROVIDER,
      inject: [HttpService, ShionConfigService],
      useFactory: (httpService: HttpService, configService: ShionConfigService) =>
        new IDataRiverPaymentProvider(httpService, configService),
    },
  ],
  exports: [SponsorService],
})
export class SponsorModule {}
