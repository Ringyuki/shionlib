import { CommentController } from './comment.controller'

describe('CommentController', () => {
  const createController = () => {
    const commentServices = {
      createGameComment: jest.fn(),
      editComment: jest.fn(),
      getRaw: jest.fn(),
      deleteComment: jest.fn(),
      getGameComments: jest.fn(),
      likeComment: jest.fn(),
    }

    return {
      commentServices,
      controller: new CommentController(commentServices as any),
    }
  }

  it('delegates createComment', async () => {
    const { controller, commentServices } = createController()
    const dto = { content: 'hello' }
    const req = { user: { sub: 'u1' } }

    await controller.createComment(dto as any, 4, req as any)

    expect(commentServices.createGameComment).toHaveBeenCalledWith(4, dto, req)
  })

  it('delegates editComment', async () => {
    const { controller, commentServices } = createController()
    const dto = { content: 'edited' }

    await controller.editComment(dto as any, 5, { user: { sub: 'u2' } } as any)

    expect(commentServices.editComment).toHaveBeenCalledWith(5, dto, { user: { sub: 'u2' } })
  })

  it('delegates getRawComment', async () => {
    const { controller, commentServices } = createController()
    const req = { user: { sub: 'u3' } }

    await controller.getRawComment(6, req as any)

    expect(commentServices.getRaw).toHaveBeenCalledWith(6, req)
  })

  it('delegates deleteComment', async () => {
    const { controller, commentServices } = createController()
    const req = { user: { sub: 'u4' } }

    await controller.deleteComment(7, req as any)

    expect(commentServices.deleteComment).toHaveBeenCalledWith(7, req)
  })

  it('delegates getGameComments', async () => {
    const { controller, commentServices } = createController()
    const query = { page: 2, pageSize: 20 }
    const req = { user: { sub: 'u5' } }

    await controller.getGameComments(8, query as any, req as any)

    expect(commentServices.getGameComments).toHaveBeenCalledWith(8, query, req)
  })

  it('delegates likeComment', async () => {
    const { controller, commentServices } = createController()
    const req = { user: { sub: 'u6' } }

    await controller.likeComment(9, req as any)

    expect(commentServices.likeComment).toHaveBeenCalledWith(9, req)
  })
})
