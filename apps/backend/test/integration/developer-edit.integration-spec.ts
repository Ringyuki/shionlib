import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { requestId } from '../../src/common/middlewares/request-id.middleware'
import { DeveloperEditController } from '../../src/modules/developer/controllers/developer-edit.controller'
import { DeveloperEditService } from '../../src/modules/developer/services/developer-edit.service'
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard'
import { PermissionService } from '../../src/modules/edit/services/permission.service'

describe('DeveloperEdit (integration)', () => {
  let app: INestApplication

  const developerEditService = {
    editDeveloperScalar: jest.fn(),
  }
  const jwtAuthGuard: CanActivate = {
    canActivate: jest.fn((context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest()
      req.user = { sub: 9001, role: 0, fid: 'family-1' }
      return true
    }),
  }
  const permissionService = {
    getAllowMaskFor: jest.fn(async () => (1n << 62n) - 1n),
  }

  beforeAll(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [DeveloperEditController],
      providers: [
        { provide: DeveloperEditService, useValue: developerEditService },
        { provide: PermissionService, useValue: permissionService },
      ],
    })
    moduleBuilder.overrideGuard(JwtAuthGuard).useValue(jwtAuthGuard)
    const moduleFixture: TestingModule = await moduleBuilder.compile()

    app = moduleFixture.createNestApplication()
    app.use((req: any, _res: any, next: () => void) => {
      req.user = { sub: 9001, role: 0, fid: 'family-1' }
      next()
    })
    app.use(requestId())
    await app.init()
  })

  afterAll(async () => {
    if (app) await app.close()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('PATCH /developer/:id/edit/scalar forwards dto and request', async () => {
    developerEditService.editDeveloperScalar.mockResolvedValueOnce({ id: 7, updated: true })

    const res = await request(app.getHttpServer())
      .patch('/developer/7/edit/scalar')
      .send({ name: 'new-dev-name' })
      .expect(200)

    expect(res.headers['shionlib-request-id']).toBeDefined()
    expect(res.body).toEqual({ id: 7, updated: true })
    expect(developerEditService.editDeveloperScalar).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ name: 'new-dev-name' }),
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )
  })

  it('returns 400 for invalid id param', async () => {
    await request(app.getHttpServer())
      .patch('/developer/not-a-number/edit/scalar')
      .send({ name: 'x' })
      .expect(400)

    expect(developerEditService.editDeveloperScalar).not.toHaveBeenCalled()
  })

  it('returns 403 when edit permission guard denies', async () => {
    permissionService.getAllowMaskFor.mockResolvedValueOnce(0n)

    const res = await request(app.getHttpServer())
      .patch('/developer/7/edit/scalar')
      .send({ name: 'x' })
      .expect(403)

    expect(res.body.statusCode).toBe(403)
    expect(developerEditService.editDeveloperScalar).not.toHaveBeenCalled()
  })
})
