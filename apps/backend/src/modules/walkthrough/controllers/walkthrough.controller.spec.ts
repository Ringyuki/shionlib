import { WalkthroughController } from './walkthrough.controller'

describe('WalkthroughController', () => {
  it('delegates walkthrough operations to service', async () => {
    const walkthroughService = {
      create: jest.fn(),
      update: jest.fn(),
      getById: jest.fn(),
      delete: jest.fn(),
      getListByGameId: jest.fn(),
    }

    const controller = new WalkthroughController(walkthroughService as any)
    const req = { user: { sub: 1, role: 1 } }
    const dto = { title: 't', content: { root: {} }, status: 'DRAFT' }
    const pagination = { page: 1, pageSize: 10 }

    await controller.create({ game_id: 9, ...dto } as any, req as any)
    await controller.update(2, dto as any, req as any)
    await controller.getById(3, req as any, 'true')
    await controller.getById(4, req as any, 'false')
    await controller.delete(5, req as any)
    await controller.getListByGameId(9, pagination as any, req as any)

    expect(walkthroughService.create).toHaveBeenCalledWith({ game_id: 9, ...dto }, req)
    expect(walkthroughService.update).toHaveBeenCalledWith(2, dto, req)
    expect(walkthroughService.getById).toHaveBeenNthCalledWith(1, 3, true, req)
    expect(walkthroughService.getById).toHaveBeenNthCalledWith(2, 4, false, req)
    expect(walkthroughService.delete).toHaveBeenCalledWith(5, req)
    expect(walkthroughService.getListByGameId).toHaveBeenCalledWith(9, pagination, req)
  })
})
