import { SponsorWebhookController } from './sponsor-webhook.controller'

describe('SponsorWebhookController', () => {
  const createController = () => {
    const sponsorService = {
      handlePaymentCallback: jest.fn(),
    }
    const sponsorWallService = {
      invalidateWallCache: jest.fn(),
    }
    const controller = new SponsorWebhookController(
      sponsorService as any,
      sponsorWallService as any,
    )
    return { sponsorService, sponsorWallService, controller }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('processes callback and invalidates wall cache', async () => {
    const { controller, sponsorService, sponsorWallService } = createController()
    sponsorService.handlePaymentCallback.mockResolvedValueOnce(undefined)
    sponsorWallService.invalidateWallCache.mockResolvedValueOnce(undefined)

    const result = await controller.handleIDataRiverCallback({ orderId: 'idr-123' })

    expect(result).toEqual({ received: true })
    expect(sponsorService.handlePaymentCallback).toHaveBeenCalledWith('idr-123')
    expect(sponsorWallService.invalidateWallCache).toHaveBeenCalled()
  })

  it('returns received:true even without orderId', async () => {
    const { controller, sponsorService } = createController()

    const result = await controller.handleIDataRiverCallback({})

    expect(result).toEqual({ received: true })
    expect(sponsorService.handlePaymentCallback).not.toHaveBeenCalled()
  })

  it('returns received:true even when processing fails', async () => {
    const { controller, sponsorService } = createController()
    sponsorService.handlePaymentCallback.mockRejectedValueOnce(new Error('provider down'))

    const result = await controller.handleIDataRiverCallback({ orderId: 'idr-123' })

    expect(result).toEqual({ received: true })
  })
})
