import { Module } from '@nestjs/common'
import { GameModule } from '../game/game.module'
import { PartnerDownloadController } from './controllers/partner-download.controller'
import { PartnerDownloadService } from './services/partner-download.service'

@Module({
  imports: [GameModule],
  controllers: [PartnerDownloadController],
  providers: [PartnerDownloadService],
})
export class PartnerModule {}
