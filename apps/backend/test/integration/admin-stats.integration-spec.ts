import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { requestId } from '../../src/common/middlewares/request-id.middleware'
import { AdminStatsController } from '../../src/modules/admin/controllers/admin-stats.controller'
import { AdminStatsService } from '../../src/modules/admin/services/admin-stats.service'
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../src/modules/auth/guards/roles.guard'

describe('AdminStats (integration)', () => {
  let app: INestApplication

  const adminStatsService = {
    getOverview: jest.fn(),
    getTrends: jest.fn(),
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
      controllers: [AdminStatsController],
      providers: [{ provide: AdminStatsService, useValue: adminStatsService }],
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

  it('GET /admin/stats/overview delegates to service', async () => {
    adminStatsService.getOverview.mockResolvedValueOnce({ totalUsers: 10, totalGames: 20 })

    const res = await request(app.getHttpServer()).get('/admin/stats/overview').expect(200)

    expect(res.headers['shionlib-request-id']).toBeDefined()
    expect(res.body).toEqual({ totalUsers: 10, totalGames: 20 })
    expect(adminStatsService.getOverview).toHaveBeenCalledTimes(1)
  })

  it('GET /admin/stats/trends forwards days query', async () => {
    adminStatsService.getTrends.mockResolvedValueOnce([{ date: '2026-02-19', games: 1, users: 2 }])

    const res = await request(app.getHttpServer())
      .get('/admin/stats/trends')
      .query({ days: 14 })
      .expect(200)

    expect(res.body).toEqual([{ date: '2026-02-19', games: 1, users: 2 }])
    expect(adminStatsService.getTrends).toHaveBeenCalledWith('14')
  })

  it('returns 403 when role guard denies access', async () => {
    ;(rolesGuard.canActivate as jest.Mock).mockReturnValueOnce(false)

    const res = await request(app.getHttpServer()).get('/admin/stats/overview').expect(403)

    expect(res.body.message).toBe('Forbidden resource')
    expect(adminStatsService.getOverview).not.toHaveBeenCalled()
  })
})
