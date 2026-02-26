import { ActivityController } from './activity.controller'

describe('ActivityController', () => {
  it('delegates getList to activity service', async () => {
    const activityService = {
      getList: jest.fn(),
    }
    const controller = new ActivityController(activityService as any)
    const dto = { page: 1, page_size: 20 }
    const req = { user: { sub: 1, content_limit: 2 } }

    await controller.getList(dto as any, req as any)

    expect(activityService.getList).toHaveBeenCalledWith(dto, req)
  })
})
