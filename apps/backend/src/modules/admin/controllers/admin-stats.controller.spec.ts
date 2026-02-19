import { AdminStatsController } from './admin-stats.controller'

describe('AdminStatsController', () => {
  it('delegates overview and trends', async () => {
    const adminStatsService = {
      getOverview: jest.fn().mockResolvedValue({ users: 1 }),
      getTrends: jest.fn().mockResolvedValue({ series: [] }),
    }
    const controller = new AdminStatsController(adminStatsService as any)

    const overview = await controller.getOverview()
    const trends = await controller.getTrends({ days: 30 } as any)

    expect(adminStatsService.getOverview).toHaveBeenCalledTimes(1)
    expect(adminStatsService.getTrends).toHaveBeenCalledWith(30)
    expect(overview).toEqual({ users: 1 })
    expect(trends).toEqual({ series: [] })
  })
})
