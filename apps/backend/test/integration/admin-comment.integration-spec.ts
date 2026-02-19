import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { requestId } from '../../src/common/middlewares/request-id.middleware'
import { AdminCommentController } from '../../src/modules/admin/controllers/admin-comment.controller'
import { AdminCommentService } from '../../src/modules/admin/services/admin-comment.service'
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../src/modules/auth/guards/roles.guard'

describe('AdminComment (integration)', () => {
  let app: INestApplication

  const adminCommentService = {
    getCommentList: jest.fn(),
    getCommentDetail: jest.fn(),
    updateCommentStatus: jest.fn(),
    rescanComment: jest.fn(),
  }
  const jwtAuthGuard: CanActivate = {
    canActivate: jest.fn((context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest()
      req.user = { sub: 9001, role: 99, fid: 'admin-family' }
      return true
    }),
  }
  const rolesGuard: CanActivate = {
    canActivate: jest.fn(() => true),
  }

  beforeAll(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [AdminCommentController],
      providers: [{ provide: AdminCommentService, useValue: adminCommentService }],
    })
    moduleBuilder.overrideGuard(JwtAuthGuard).useValue(jwtAuthGuard)
    moduleBuilder.overrideGuard(RolesGuard).useValue(rolesGuard)
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

  it('GET /admin/comments forwards query', async () => {
    adminCommentService.getCommentList.mockResolvedValueOnce({
      items: [],
      meta: { totalItems: 0, itemCount: 0, itemsPerPage: 10, totalPages: 0, currentPage: 1 },
    })

    const res = await request(app.getHttpServer())
      .get('/admin/comments')
      .query({ page: 2, pageSize: 20, search: 'hello' })
      .expect(200)

    expect(res.headers['shionlib-request-id']).toBeDefined()
    expect(adminCommentService.getCommentList).toHaveBeenCalledWith(
      expect.objectContaining({
        page: '2',
        pageSize: '20',
        search: 'hello',
      }),
    )
  })

  it('GET /admin/comments/:id dispatches detail query', async () => {
    adminCommentService.getCommentDetail.mockResolvedValueOnce({ id: 11 })

    const res = await request(app.getHttpServer()).get('/admin/comments/11').expect(200)

    expect(res.body).toEqual({ id: 11 })
    expect(adminCommentService.getCommentDetail).toHaveBeenCalledWith(11)
  })

  it('PATCH /admin/comments/:id/status forwards dto and actor', async () => {
    adminCommentService.updateCommentStatus.mockResolvedValueOnce({ id: 12, status: 2 })

    const res = await request(app.getHttpServer())
      .patch('/admin/comments/12/status')
      .send({ status: 2, reason: 'reviewed' })
      .expect(200)

    expect(res.body).toEqual({ id: 12, status: 2 })
    expect(adminCommentService.updateCommentStatus).toHaveBeenCalledWith(
      12,
      expect.objectContaining({ status: 2, reason: 'reviewed' }),
      expect.objectContaining({ sub: 9001 }),
    )
  })

  it('POST /admin/comments/:id/rescan dispatches rescan', async () => {
    adminCommentService.rescanComment.mockResolvedValueOnce({ accepted: true })

    const res = await request(app.getHttpServer()).post('/admin/comments/13/rescan').expect(201)

    expect(res.body).toEqual({ accepted: true })
    expect(adminCommentService.rescanComment).toHaveBeenCalledWith(13)
  })

  it('returns 400 for invalid id in param', async () => {
    await request(app.getHttpServer()).get('/admin/comments/not-a-number').expect(400)
    await request(app.getHttpServer())
      .patch('/admin/comments/not-a-number/status')
      .send({ status: 1 })
      .expect(400)
    await request(app.getHttpServer()).post('/admin/comments/not-a-number/rescan').expect(400)

    expect(adminCommentService.getCommentDetail).not.toHaveBeenCalled()
    expect(adminCommentService.updateCommentStatus).not.toHaveBeenCalled()
    expect(adminCommentService.rescanComment).not.toHaveBeenCalled()
  })

  it('returns 403 when role guard denies access', async () => {
    ;(rolesGuard.canActivate as jest.Mock).mockReturnValueOnce(false)

    const res = await request(app.getHttpServer()).get('/admin/comments').expect(403)

    expect(res.body.message).toBe('Forbidden resource')
    expect(adminCommentService.getCommentList).not.toHaveBeenCalled()
  })
})
