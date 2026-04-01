import { Module } from '@nestjs/common'
import { AdController } from './controllers/ad.controller'
import { AdAdminController } from './controllers/ad-admin.controller'
import { AdService } from './services/ad.service'

@Module({
  controllers: [AdController, AdAdminController],
  providers: [AdService],
})
export class AdModule {}
