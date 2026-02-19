import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { requestId } from '../../src/common/middlewares/request-id.middleware'
import { PermissionController } from '../../src/modules/edit/controllers/permission.controller'
import { PermissionService } from '../../src/modules/edit/services/permission.service'
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard'

describe('Permission (integration)', () => {
  let app: INestApplication

  const permissionService = {
    getPermissionDetails: jest.fn(),
  }
  const jwtAuthGuard: CanActivate = {
    canActivate: jest.fn((context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest()
      req.user = { sub: 9001, role: 2, fid: 'family-1' }
      return true
    }),
  }

  beforeAll(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [PermissionController],
      providers: [{ provide: PermissionService, useValue: permissionService }],
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

  it('POST /permissions delegates to permission service with actor + entity', async () => {
    permissionService.getPermissionDetails.mockResolvedValueOnce({ allowMask: '3' })

    const res = await request(app.getHttpServer())
      .post('/permissions')
      .send({ entity: 'game' })
      .expect(201)

    expect(res.headers['shionlib-request-id']).toBeDefined()
    expect(res.body).toEqual({ allowMask: '3' })
    expect(permissionService.getPermissionDetails).toHaveBeenCalledWith(9001, 2, 'game')
  })

  it('returns 403 when auth guard denies access', async () => {
    ;(jwtAuthGuard.canActivate as jest.Mock).mockReturnValueOnce(false)

    const res = await request(app.getHttpServer())
      .post('/permissions')
      .send({ entity: 'game' })
      .expect(403)

    expect(res.body.message).toBe('Forbidden resource')
    expect(permissionService.getPermissionDetails).not.toHaveBeenCalled()
  })
})
