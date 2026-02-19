import { AdminCommentController } from './admin-comment.controller'

describe('AdminCommentController', () => {
  it('delegates all comment admin operations', async () => {
    const adminCommentService = {
      getCommentList: jest.fn(),
      getCommentDetail: jest.fn(),
      updateCommentStatus: jest.fn(),
      rescanComment: jest.fn(),
    }
    const controller = new AdminCommentController(adminCommentService as any)
    const req = { user: { sub: 'admin' } }

    await controller.getCommentList({ page: 1 } as any)
    await controller.getCommentDetail(1)
    await controller.updateCommentStatus(2, { status: 1 } as any, req as any)
    await controller.rescanComment(3)

    expect(adminCommentService.getCommentList).toHaveBeenCalledWith({ page: 1 })
    expect(adminCommentService.getCommentDetail).toHaveBeenCalledWith(1)
    expect(adminCommentService.updateCommentStatus).toHaveBeenCalledWith(2, { status: 1 }, req.user)
    expect(adminCommentService.rescanComment).toHaveBeenCalledWith(3)
  })
})
