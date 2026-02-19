import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { requestId } from '../../src/common/middlewares/request-id.middleware'
import { AdminContentController } from '../../src/modules/admin/controllers/admin-content.controller'
import { AdminContentService } from '../../src/modules/admin/services/admin-content.service'
import { AdminGameService } from '../../src/modules/admin/services/admin-game.service'
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../src/modules/auth/guards/roles.guard'

describe('AdminContent (integration)', () => {
  let app: INestApplication

  const adminContentService = {
    getGameList: jest.fn(),
    updateGameStatus: jest.fn(),
    editGameScalar: jest.fn(),
    deleteGame: jest.fn(),
    addGameToRecentUpdate: jest.fn(),
    removeGameFromRecentUpdate: jest.fn(),
    getCharacterList: jest.fn(),
    getDeveloperList: jest.fn(),
    getDownloadResourceReportList: jest.fn(),
    getDownloadResourceReportDetail: jest.fn(),
    reviewDownloadResourceReport: jest.fn(),
    getMalwareScanCaseList: jest.fn(),
    getMalwareScanCaseDetail: jest.fn(),
    reviewMalwareScanCase: jest.fn(),
  }
  const adminGameService = {
    getScalar: jest.fn(),
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
      controllers: [AdminContentController],
      providers: [
        { provide: AdminContentService, useValue: adminContentService },
        { provide: AdminGameService, useValue: adminGameService },
      ],
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

  it('covers game list and game manage endpoints', async () => {
    adminContentService.getGameList.mockResolvedValueOnce({ items: [], meta: { totalItems: 0 } })
    adminContentService.updateGameStatus.mockResolvedValueOnce({ id: 11, status: 2 })
    adminGameService.getScalar.mockResolvedValueOnce({ id: 11, title_zh: 'g' })
    adminContentService.editGameScalar.mockResolvedValueOnce({ updated: true })
    adminContentService.deleteGame.mockResolvedValueOnce({ deleted: true })
    adminContentService.addGameToRecentUpdate.mockResolvedValueOnce({ added: true })
    adminContentService.removeGameFromRecentUpdate.mockResolvedValueOnce({ removed: true })

    const listRes = await request(app.getHttpServer())
      .get('/admin/content/games')
      .query({ page: 2, pageSize: 10, search: 'abc' })
      .expect(200)
    expect(listRes.headers['shionlib-request-id']).toBeDefined()
    expect(adminContentService.getGameList).toHaveBeenCalledWith(
      expect.objectContaining({ page: '2', pageSize: '10', search: 'abc' }),
    )

    await request(app.getHttpServer())
      .patch('/admin/content/games/11/status')
      .send({ status: '2' })
      .expect(200)
    expect(adminContentService.updateGameStatus).toHaveBeenCalledWith(11, 2)

    await request(app.getHttpServer()).get('/admin/content/games/11/edit/scalar').expect(200)
    expect(adminGameService.getScalar).toHaveBeenCalledWith(11)

    await request(app.getHttpServer())
      .patch('/admin/content/games/11/edit/scalar')
      .send({ title_zh: 'new title' })
      .expect(200)
    expect(adminContentService.editGameScalar).toHaveBeenCalledWith(
      11,
      expect.objectContaining({ title_zh: 'new title' }),
    )

    await request(app.getHttpServer()).delete('/admin/content/games/11').expect(200)
    expect(adminContentService.deleteGame).toHaveBeenCalledWith(11)

    await request(app.getHttpServer()).put('/admin/content/games/11/recent-update').expect(200)
    expect(adminContentService.addGameToRecentUpdate).toHaveBeenCalledWith(11)

    await request(app.getHttpServer()).delete('/admin/content/games/11/recent-update').expect(200)
    expect(adminContentService.removeGameFromRecentUpdate).toHaveBeenCalledWith(11)
  })

  it('covers character and developer list endpoints', async () => {
    adminContentService.getCharacterList.mockResolvedValueOnce({
      items: [],
      meta: { totalItems: 0 },
    })
    adminContentService.getDeveloperList.mockResolvedValueOnce({
      items: [],
      meta: { totalItems: 0 },
    })

    await request(app.getHttpServer())
      .get('/admin/content/characters')
      .query({ page: 1, pageSize: 5, search: 'c' })
      .expect(200)
    expect(adminContentService.getCharacterList).toHaveBeenCalledWith(
      expect.objectContaining({ page: '1', pageSize: '5', search: 'c' }),
    )

    await request(app.getHttpServer())
      .get('/admin/content/developers')
      .query({ page: 3, pageSize: 5, search: 'd' })
      .expect(200)
    expect(adminContentService.getDeveloperList).toHaveBeenCalledWith(
      expect.objectContaining({ page: '3', pageSize: '5', search: 'd' }),
    )
  })

  it('covers download-resource-report endpoints', async () => {
    adminContentService.getDownloadResourceReportList.mockResolvedValueOnce({
      items: [{ id: 1 }],
      meta: { totalItems: 1 },
    })
    adminContentService.getDownloadResourceReportDetail.mockResolvedValueOnce({ id: 12 })
    adminContentService.reviewDownloadResourceReport.mockResolvedValueOnce({ reviewed: true })

    await request(app.getHttpServer())
      .get('/admin/content/download-resource-reports')
      .query({ page: 2, pageSize: 20, status: 0 })
      .expect(200)
    expect(adminContentService.getDownloadResourceReportList).toHaveBeenCalledWith(
      expect.objectContaining({ page: '2', pageSize: '20', status: '0' }),
    )

    await request(app.getHttpServer())
      .get('/admin/content/download-resource-reports/12')
      .expect(200)
    expect(adminContentService.getDownloadResourceReportDetail).toHaveBeenCalledWith(12)

    await request(app.getHttpServer())
      .patch('/admin/content/download-resource-reports/12/review')
      .send({ action: 'approve' })
      .expect(200)
    expect(adminContentService.reviewDownloadResourceReport).toHaveBeenCalledWith(
      12,
      expect.objectContaining({ action: 'approve' }),
      expect.objectContaining({ sub: 9001 }),
    )
  })

  it('covers malware-scan-case endpoints', async () => {
    adminContentService.getMalwareScanCaseList.mockResolvedValueOnce({
      items: [{ id: 1 }],
      meta: { totalItems: 1 },
    })
    adminContentService.getMalwareScanCaseDetail.mockResolvedValueOnce({ id: 23 })
    adminContentService.reviewMalwareScanCase.mockResolvedValueOnce({ reviewed: true })

    await request(app.getHttpServer())
      .get('/admin/content/malware-scan-cases')
      .query({ page: 1, pageSize: 10, status: 0 })
      .expect(200)
    expect(adminContentService.getMalwareScanCaseList).toHaveBeenCalledWith(
      expect.objectContaining({ page: '1', pageSize: '10', status: '0' }),
    )

    await request(app.getHttpServer()).get('/admin/content/malware-scan-cases/23').expect(200)
    expect(adminContentService.getMalwareScanCaseDetail).toHaveBeenCalledWith(23)

    await request(app.getHttpServer())
      .patch('/admin/content/malware-scan-cases/23/review')
      .send({ action: 'allow' })
      .expect(200)
    expect(adminContentService.reviewMalwareScanCase).toHaveBeenCalledWith(
      23,
      expect.objectContaining({ action: 'allow' }),
      expect.objectContaining({ sub: 9001 }),
    )
  })

  it('returns 400 for invalid id/status parse errors', async () => {
    await request(app.getHttpServer())
      .patch('/admin/content/games/not-a-number/status')
      .send({ status: '2' })
      .expect(400)
    await request(app.getHttpServer())
      .patch('/admin/content/games/1/status')
      .send({ status: 'bad' })
      .expect(400)
    await request(app.getHttpServer())
      .get('/admin/content/games/not-a-number/edit/scalar')
      .expect(400)
    await request(app.getHttpServer())
      .patch('/admin/content/games/not-a-number/edit/scalar')
      .send({})
      .expect(400)
    await request(app.getHttpServer()).delete('/admin/content/games/not-a-number').expect(400)
    await request(app.getHttpServer())
      .put('/admin/content/games/not-a-number/recent-update')
      .expect(400)
    await request(app.getHttpServer())
      .delete('/admin/content/games/not-a-number/recent-update')
      .expect(400)
    await request(app.getHttpServer())
      .get('/admin/content/download-resource-reports/not-a-number')
      .expect(400)
    await request(app.getHttpServer())
      .patch('/admin/content/download-resource-reports/not-a-number/review')
      .send({ action: 'approve' })
      .expect(400)
    await request(app.getHttpServer())
      .get('/admin/content/malware-scan-cases/not-a-number')
      .expect(400)
    await request(app.getHttpServer())
      .patch('/admin/content/malware-scan-cases/not-a-number/review')
      .send({ action: 'allow' })
      .expect(400)
  })

  it('returns 403 when role guard denies access', async () => {
    ;(rolesGuard.canActivate as jest.Mock).mockReturnValueOnce(false)

    const res = await request(app.getHttpServer()).get('/admin/content/games').expect(403)

    expect(res.body.message).toBe('Forbidden resource')
    expect(adminContentService.getGameList).not.toHaveBeenCalled()
  })
})
