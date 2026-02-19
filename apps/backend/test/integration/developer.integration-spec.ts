import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { requestId } from '../../src/common/middlewares/request-id.middleware'
import { DeveloperController } from '../../src/modules/developer/controllers/developer.controller'
import { DeveloperService } from '../../src/modules/developer/services/developer.service'
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../src/modules/auth/guards/roles.guard'

describe('Developer (integration)', () => {
  let app: INestApplication

  const developerService = {
    getList: jest.fn(),
    getById: jest.fn(),
    deleteById: jest.fn(),
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
      controllers: [DeveloperController],
      providers: [{ provide: DeveloperService, useValue: developerService }],
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

  it('covers GET list and GET by id', async () => {
    developerService.getList.mockResolvedValueOnce({ items: [], meta: { totalItems: 0 } })
    developerService.getById.mockResolvedValueOnce({ id: 8 })

    const listRes = await request(app.getHttpServer())
      .get('/developer/list')
      .query({ page: 2, pageSize: 10, name: 'dev' })
      .expect(200)

    expect(listRes.headers['shionlib-request-id']).toBeDefined()
    expect(developerService.getList).toHaveBeenCalledWith(
      expect.objectContaining({ page: '2', pageSize: '10', name: 'dev' }),
    )

    const detailRes = await request(app.getHttpServer()).get('/developer/8').expect(200)
    expect(detailRes.body).toEqual({ id: 8 })
    expect(developerService.getById).toHaveBeenCalledWith(8)
  })

  it('DELETE /developer/:id dispatches delete for authorized admin', async () => {
    developerService.deleteById.mockResolvedValueOnce({ deleted: true })

    const res = await request(app.getHttpServer()).delete('/developer/9').expect(200)

    expect(res.body).toEqual({ deleted: true })
    expect(developerService.deleteById).toHaveBeenCalledWith(9)
  })

  it('returns 400 for invalid id path params', async () => {
    await request(app.getHttpServer()).get('/developer/not-a-number').expect(400)
    await request(app.getHttpServer()).delete('/developer/not-a-number').expect(400)

    expect(developerService.getById).not.toHaveBeenCalled()
    expect(developerService.deleteById).not.toHaveBeenCalled()
  })

  it('returns 403 when role guard denies delete', async () => {
    ;(rolesGuard.canActivate as jest.Mock).mockReturnValueOnce(false)

    const res = await request(app.getHttpServer()).delete('/developer/9').expect(403)

    expect(res.body.message).toBe('Forbidden resource')
    expect(developerService.deleteById).not.toHaveBeenCalled()
  })
})
