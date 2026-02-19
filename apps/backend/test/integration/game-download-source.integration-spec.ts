import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { requestId } from '../../src/common/middlewares/request-id.middleware'
import { GameDownloadSourceController } from '../../src/modules/game/controllers/game-download-source.controller'
import { GameDownloadSourceService } from '../../src/modules/game/services/game-download-resource.service'
import { GameDownloadResourceReportService } from '../../src/modules/game/services/game-download-resource-report.service'
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../src/modules/auth/guards/roles.guard'

describe('GameDownloadSource (integration)', () => {
  let app: INestApplication

  const gameDownloadSourceService = {
    getList: jest.fn(),
    delete: jest.fn(),
    edit: jest.fn(),
    migrateCreate: jest.fn(),
    migrateCreateFile: jest.fn(),
    reuploadFile: jest.fn(),
    getFileHistory: jest.fn(),
  }
  const gameDownloadSourceReportService = {
    create: jest.fn(),
  }
  const jwtAuthGuard: CanActivate = {
    canActivate: jest.fn((context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest()
      req.user = { sub: 9001, role: 100, fid: 'family-1' }
      return true
    }),
  }
  const rolesGuard: CanActivate = {
    canActivate: jest.fn(() => true),
  }

  beforeAll(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [GameDownloadSourceController],
      providers: [
        { provide: GameDownloadSourceService, useValue: gameDownloadSourceService },
        { provide: GameDownloadResourceReportService, useValue: gameDownloadSourceReportService },
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

  it('covers list and file history endpoints', async () => {
    gameDownloadSourceService.getList.mockResolvedValueOnce({ items: [], meta: { totalItems: 0 } })
    gameDownloadSourceService.getFileHistory.mockResolvedValueOnce({ events: [] })

    const listRes = await request(app.getHttpServer())
      .get('/game/download-source/list')
      .query({ page: 2, pageSize: 10 })
      .expect(200)
    expect(listRes.headers['shionlib-request-id']).toBeDefined()
    expect(gameDownloadSourceService.getList).toHaveBeenCalledWith(
      expect.objectContaining({ page: '2', pageSize: '10' }),
    )

    const historyRes = await request(app.getHttpServer())
      .get('/game/download-source/file/55/history')
      .expect(200)
    expect(historyRes.body).toEqual({ events: [] })
    expect(gameDownloadSourceService.getFileHistory).toHaveBeenCalledWith(55)
  })

  it('covers guarded mutate/report endpoints', async () => {
    gameDownloadSourceService.delete.mockResolvedValueOnce({ deleted: true })
    gameDownloadSourceService.edit.mockResolvedValueOnce({ updated: true })
    gameDownloadSourceService.migrateCreate.mockResolvedValueOnce({ id: 1 })
    gameDownloadSourceService.migrateCreateFile.mockResolvedValueOnce({ id: 2 })
    gameDownloadSourceService.reuploadFile.mockResolvedValueOnce({ accepted: true })
    gameDownloadSourceReportService.create.mockResolvedValueOnce({ reported: true })

    await request(app.getHttpServer()).delete('/game/download-source/10').expect(200)
    expect(gameDownloadSourceService.delete).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )

    await request(app.getHttpServer())
      .patch('/game/download-source/10')
      .send({ title: 'new title' })
      .expect(200)
    expect(gameDownloadSourceService.edit).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ title: 'new title' }),
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )

    await request(app.getHttpServer())
      .post('/game/download-source/migrate/20')
      .send({ title: 'res' })
      .expect(201)
    expect(gameDownloadSourceService.migrateCreate).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'res' }),
      20,
    )

    await request(app.getHttpServer())
      .post('/game/download-source/migrate/file/30')
      .send({ path: '/tmp/a.bin' })
      .expect(201)
    expect(gameDownloadSourceService.migrateCreateFile).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/tmp/a.bin' }),
      30,
    )

    await request(app.getHttpServer())
      .put('/game/download-source/file/40/reupload')
      .send({ reason: 'replace' })
      .expect(200)
    expect(gameDownloadSourceService.reuploadFile).toHaveBeenCalledWith(
      40,
      expect.objectContaining({ reason: 'replace' }),
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )

    await request(app.getHttpServer())
      .post('/game/download-source/10/report')
      .send({ reason: 'bad link' })
      .expect(201)
    expect(gameDownloadSourceReportService.create).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ reason: 'bad link' }),
      9001,
    )
  })

  it('returns 400 for invalid id path params', async () => {
    await request(app.getHttpServer()).delete('/game/download-source/not-a-number').expect(400)
    await request(app.getHttpServer())
      .patch('/game/download-source/not-a-number')
      .send({})
      .expect(400)
    await request(app.getHttpServer())
      .post('/game/download-source/migrate/not-a-number')
      .send({})
      .expect(400)
    await request(app.getHttpServer())
      .post('/game/download-source/migrate/file/not-a-number')
      .send({})
      .expect(400)
    await request(app.getHttpServer())
      .put('/game/download-source/file/not-a-number/reupload')
      .send({})
      .expect(400)
    await request(app.getHttpServer())
      .get('/game/download-source/file/not-a-number/history')
      .expect(400)
    await request(app.getHttpServer())
      .post('/game/download-source/not-a-number/report')
      .send({})
      .expect(400)
  })

  it('returns 403 when roles guard denies guarded endpoint', async () => {
    ;(rolesGuard.canActivate as jest.Mock).mockReturnValueOnce(false)

    const res = await request(app.getHttpServer()).delete('/game/download-source/10').expect(403)

    expect(res.body.message).toBe('Forbidden resource')
    expect(gameDownloadSourceService.delete).not.toHaveBeenCalled()
  })
})
