import { HealthController } from './health.controller'

describe('HealthController', () => {
  it('delegates getHealth to health service', async () => {
    const healthService = {
      getHealth: jest.fn().mockResolvedValue({ ok: true }),
    }
    const controller = new HealthController(healthService as any)

    const result = await controller.getHealth()

    expect(healthService.getHealth).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ ok: true })
  })
})
