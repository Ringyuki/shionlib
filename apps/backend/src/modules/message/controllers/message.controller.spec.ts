import { MessageController } from './message.controller'

describe('MessageController', () => {
  const createController = () => {
    const messageService = {
      getList: jest.fn(),
      getUnreadCount: jest.fn(),
      getById: jest.fn(),
      markAllAsRead: jest.fn(),
      markAllAsUnread: jest.fn(),
      markAsRead: jest.fn(),
    }

    return {
      messageService,
      controller: new MessageController(messageService as any),
    }
  }

  it('delegates list and unread endpoints', async () => {
    const { controller, messageService } = createController()
    const req = { user: { sub: 1 } }
    const dto = { page: 1, page_size: 20 }

    await controller.getList(dto as any, req as any)
    await controller.getUnreadCount(req as any)

    expect(messageService.getList).toHaveBeenCalledWith(dto, req)
    expect(messageService.getUnreadCount).toHaveBeenCalledWith(req)
  })

  it('delegates read/unread mutation endpoints', async () => {
    const { controller, messageService } = createController()
    const req = { user: { sub: 1 } }

    await controller.getById(11, req as any)
    await controller.markAllAsRead(req as any)
    await controller.markAllAsUnread(req as any)
    await controller.markAsRead(12, req as any)

    expect(messageService.getById).toHaveBeenCalledWith(11, req)
    expect(messageService.markAllAsRead).toHaveBeenCalledWith(req)
    expect(messageService.markAllAsUnread).toHaveBeenCalledWith(req)
    expect(messageService.markAsRead).toHaveBeenCalledWith(12, req)
  })
})
