import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { requestId } from '../../src/common/middlewares/request-id.middleware'
import { UndoController } from '../../src/modules/edit/controllers/undo.controller'
import { UndoService } from '../../src/modules/edit/services/undo.service'
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../src/modules/auth/guards/roles.guard'

describe('Undo (integration)', () => {
  let app: INestApplication

  const undoService = {
    undo: jest.fn(),
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
      controllers: [UndoController],
      providers: [{ provide: UndoService, useValue: undoService }],
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

  it('POST /edit/:id/undo delegates to undo service', async () => {
    undoService.undo.mockResolvedValueOnce({ undone: true })

    const res = await request(app.getHttpServer())
      .post('/edit/23/undo')
      .send({ reason: 'rollback', dryRun: false })
      .expect(201)

    expect(res.headers['shionlib-request-id']).toBeDefined()
    expect(res.body).toEqual({ undone: true })
    expect(undoService.undo).toHaveBeenCalledWith(
      23,
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
      expect.objectContaining({ reason: 'rollback', dryRun: false }),
    )
  })

  it('returns 400 for invalid id param', async () => {
    await request(app.getHttpServer())
      .post('/edit/not-a-number/undo')
      .send({ reason: 'x' })
      .expect(400)

    expect(undoService.undo).not.toHaveBeenCalled()
  })

  it('returns 403 when role guard denies access', async () => {
    ;(rolesGuard.canActivate as jest.Mock).mockReturnValueOnce(false)

    const res = await request(app.getHttpServer())
      .post('/edit/23/undo')
      .send({ reason: 'x' })
      .expect(403)

    expect(res.body.message).toBe('Forbidden resource')
    expect(undoService.undo).not.toHaveBeenCalled()
  })
})
