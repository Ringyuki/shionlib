import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { requestId } from '../../src/common/middlewares/request-id.middleware'
import { CommentController } from '../../src/modules/comment/controllers/comment.controller'
import { CommentServices } from '../../src/modules/comment/services/comment.service'
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard'

describe('Comment (integration)', () => {
  let app: INestApplication

  const commentServices = {
    createGameComment: jest.fn(),
    editComment: jest.fn(),
    getRaw: jest.fn(),
    deleteComment: jest.fn(),
    getGameComments: jest.fn(),
    likeComment: jest.fn(),
  }
  const jwtAuthGuard: CanActivate = {
    canActivate: jest.fn((context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest()
      req.user = { sub: 9001, role: 0, fid: 'family-1' }
      return true
    }),
  }

  beforeAll(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [CommentController],
      providers: [{ provide: CommentServices, useValue: commentServices }],
    })
    moduleBuilder.overrideGuard(JwtAuthGuard).useValue(jwtAuthGuard)
    const moduleFixture: TestingModule = await moduleBuilder.compile()

    app = moduleFixture.createNestApplication()
    app.use(requestId())
    await app.init()
  })

  afterAll(async () => {
    if (app) await app.close()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('covers guarded comment mutation endpoints', async () => {
    commentServices.createGameComment.mockResolvedValueOnce({ id: 1 })
    commentServices.editComment.mockResolvedValueOnce({ id: 1, edited: true })
    commentServices.getRaw.mockResolvedValueOnce({ id: 1, content: 'raw' })
    commentServices.deleteComment.mockResolvedValueOnce({ deleted: true })
    commentServices.likeComment.mockResolvedValueOnce({ liked: true })

    await request(app.getHttpServer())
      .post('/comment/game/10')
      .send({ content: 'hello' })
      .expect(201)
    expect(commentServices.createGameComment).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ content: 'hello' }),
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )

    await request(app.getHttpServer()).patch('/comment/1').send({ content: 'edited' }).expect(200)
    expect(commentServices.editComment).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ content: 'edited' }),
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )

    await request(app.getHttpServer()).get('/comment/1/raw').expect(200)
    expect(commentServices.getRaw).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )

    await request(app.getHttpServer()).delete('/comment/1').expect(200)
    expect(commentServices.deleteComment).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )

    await request(app.getHttpServer()).post('/comment/1/like').expect(201)
    expect(commentServices.likeComment).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )
  })

  it('covers GET /comment/game/:game_id query forwarding', async () => {
    commentServices.getGameComments.mockResolvedValueOnce({ items: [], meta: { totalItems: 0 } })

    const res = await request(app.getHttpServer())
      .get('/comment/game/99')
      .query({ page: 2, pageSize: 20 })
      .expect(200)

    expect(res.headers['shionlib-request-id']).toBeDefined()
    expect(commentServices.getGameComments).toHaveBeenCalledTimes(1)
    expect(commentServices.getGameComments.mock.calls[0][0]).toBe(99)
    expect(commentServices.getGameComments.mock.calls[0][1]).toEqual(
      expect.objectContaining({ page: '2', pageSize: '20' }),
    )
  })

  it('returns 400 for invalid id path params', async () => {
    await request(app.getHttpServer())
      .post('/comment/game/not-a-number')
      .send({ content: 'x' })
      .expect(400)
    await request(app.getHttpServer())
      .patch('/comment/not-a-number')
      .send({ content: 'x' })
      .expect(400)
    await request(app.getHttpServer()).get('/comment/not-a-number/raw').expect(400)
    await request(app.getHttpServer()).delete('/comment/not-a-number').expect(400)
    await request(app.getHttpServer()).get('/comment/game/not-a-number').expect(400)
    await request(app.getHttpServer()).post('/comment/not-a-number/like').expect(400)
  })

  it('returns 403 when auth guard denies access', async () => {
    ;(jwtAuthGuard.canActivate as jest.Mock).mockReturnValueOnce(false)

    const res = await request(app.getHttpServer()).post('/comment/1/like').expect(403)

    expect(res.body.message).toBe('Forbidden resource')
    expect(commentServices.likeComment).not.toHaveBeenCalled()
  })
})
