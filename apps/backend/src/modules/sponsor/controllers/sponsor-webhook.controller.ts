import { Controller, Post, Body, HttpCode, Logger } from '@nestjs/common'
import { SponsorService } from '../services/sponsor.service'
import { SponsorWallService } from '../services/sponsor-wall.service'

@Controller('sponsor/webhook')
export class SponsorWebhookController {
  private readonly logger = new Logger(SponsorWebhookController.name)

  constructor(
    private readonly sponsorService: SponsorService,
    private readonly sponsorWallService: SponsorWallService,
  ) {}

  @Post('idatariver')
  @HttpCode(200)
  async handleIDataRiverCallback(@Body() body: Record<string, unknown>) {
    const providerOrderId = body.orderId as string
    if (!providerOrderId) {
      this.logger.warn('Webhook received without orderId')
      return { received: true }
    }

    try {
      await this.sponsorService.handlePaymentCallback(providerOrderId)
      await this.sponsorWallService.invalidateWallCache()
    } catch (error) {
      this.logger.error(`Webhook processing failed for order ${providerOrderId}`, error.stack)
    }

    return { received: true }
  }
}
