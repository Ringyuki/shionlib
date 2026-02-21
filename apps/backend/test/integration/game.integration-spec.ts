import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { requestId } from '../../src/common/middlewares/request-id.middleware'
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard'
import { CacheService } from '../../src/modules/cache/services/cache.service'
import { GameController } from '../../src/modules/game/controllers/game.controller'
import { GameDownloadSourceService } from '../../src/modules/game/services/game-download-resource.service'
import { GameService } from '../../src/modules/game/services/game.service'

describe('Game (integration)', () => {
  let app: INestApplication

  const gameService = {
    getList: jest.fn(),
    getRandomGameId: jest.fn(),
    getRecentUpdate: jest.fn(),
    getById: jest.fn(),
    getHeader: jest.fn(),
    getDetails: jest.fn(),
    getCharacters: jest.fn(),
    increaseViews: jest.fn(),
  }
  const gameDownloadSourceService = {
    getByGameId: jest.fn(),
    getDownloadLink: jest.fn(),
    create: jest.fn(),
  }
  const cacheService = {
    get: jest.fn(),
    set: jest.fn(),
  }
  const jwtAuthGuard: CanActivate = {
    canActivate: jest.fn((context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest()
      req.user = { sub: 9001, role: 0, fid: 'family-1', content_limit: 2 }
      return true
    }),
  }

  beforeAll(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [GameController],
      providers: [
        { provide: GameService, useValue: gameService },
        { provide: GameDownloadSourceService, useValue: gameDownloadSourceService },
        { provide: CacheService, useValue: cacheService },
      ],
    })
    moduleBuilder.overrideGuard(JwtAuthGuard).useValue(jwtAuthGuard)
    const moduleFixture: TestingModule = await moduleBuilder.compile()

    app = moduleFixture.createNestApplication()
    app.use((req: any, _res: any, next: () => void) => {
      req.user = { sub: 9001, role: 0, fid: 'family-1', content_limit: 2 }
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

  it('covers list and recent-update cache hit/miss paths', async () => {
    cacheService.get.mockResolvedValueOnce({ items: [{ id: 100 }], meta: { totalItems: 1 } })

    const cacheHitRes = await request(app.getHttpServer())
      .get('/game/list')
      .query({ page: 1, pageSize: 10, developer_id: 11, character_id: 12 })
      .expect(200)
    expect(cacheHitRes.headers['shionlib-request-id']).toBeDefined()
    expect(cacheHitRes.body).toEqual({ items: [{ id: 100 }], meta: { totalItems: 1 } })
    expect(gameService.getList).not.toHaveBeenCalled()

    cacheService.get.mockResolvedValueOnce(null)
    gameService.getList.mockResolvedValueOnce({ items: [{ id: 1 }], meta: { totalItems: 1 } })

    const cacheMissRes = await request(app.getHttpServer())
      .get('/game/list')
      .query({ page: 2, pageSize: 8, developer_id: 21, character_id: 22 })
      .expect(200)
    expect(cacheMissRes.body).toEqual({ items: [{ id: 1 }], meta: { totalItems: 1 } })
    expect(gameService.getList).toHaveBeenCalledWith(
      expect.objectContaining({
        page: '2',
        pageSize: '8',
        developer_id: '21',
        character_id: '22',
      }),
      2,
    )
    expect(cacheService.set).toHaveBeenCalledWith(
      expect.stringContaining('game:list:auth:9001:cl:2:query:'),
      { items: [{ id: 1 }], meta: { totalItems: 1 } },
      30 * 60 * 1000,
    )

    cacheService.get.mockResolvedValueOnce(null)
    gameService.getRecentUpdate.mockResolvedValueOnce({
      items: [{ id: 9 }],
      meta: { totalItems: 1 },
    })

    const recentRes = await request(app.getHttpServer())
      .get('/game/recent-update')
      .query({ page: 3, pageSize: 5 })
      .expect(200)
    expect(recentRes.body).toEqual({ items: [{ id: 9 }], meta: { totalItems: 1 } })
    expect(gameService.getRecentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ page: '3', pageSize: '5' }),
      2,
    )
    expect(cacheService.set).toHaveBeenCalledWith(
      expect.stringContaining('game:recent-update:auth:9001:cl:2:query:'),
      { items: [{ id: 9 }], meta: { totalItems: 1 } },
      30 * 60 * 1000,
    )
  })

  it('covers game details, views and download-source endpoints', async () => {
    gameService.getRandomGameId.mockResolvedValueOnce(88)
    cacheService.get.mockResolvedValueOnce(null)
    gameService.getById.mockResolvedValueOnce({ id: 88 })
    cacheService.get.mockResolvedValueOnce(null)
    gameService.getHeader.mockResolvedValueOnce({ id: 88, title: 'h' })
    cacheService.get.mockResolvedValueOnce(null)
    gameService.getDetails.mockResolvedValueOnce({ id: 88, detail: true })
    cacheService.get.mockResolvedValueOnce(null)
    gameService.getCharacters.mockResolvedValueOnce({ items: [] })
    gameService.increaseViews.mockResolvedValueOnce({ ok: true })
    gameDownloadSourceService.getByGameId.mockResolvedValueOnce({ items: [] })
    gameDownloadSourceService.getDownloadLink.mockResolvedValueOnce({
      link: 'https://download.example/game.bin',
    })
    gameDownloadSourceService.create.mockResolvedValueOnce({ id: 66 })

    await request(app.getHttpServer()).get('/game/random').expect(200)
    expect(gameService.getRandomGameId).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )

    await request(app.getHttpServer()).get('/game/88').expect(200)
    expect(gameService.getById).toHaveBeenCalledWith(88, 2)
    expect(cacheService.set).toHaveBeenCalledWith(
      'game:88:auth:9001:cl:2',
      { id: 88 },
      30 * 60 * 1000,
    )

    await request(app.getHttpServer()).get('/game/88/header').expect(200)
    expect(gameService.getHeader).toHaveBeenCalledWith(88, 2)

    await request(app.getHttpServer()).get('/game/88/details').expect(200)
    expect(gameService.getDetails).toHaveBeenCalledWith(88, 2)

    await request(app.getHttpServer()).get('/game/88/characters').expect(200)
    expect(gameService.getCharacters).toHaveBeenCalledWith(88, 2)

    await request(app.getHttpServer()).post('/game/88/view').expect(201)
    expect(gameService.increaseViews).toHaveBeenCalledWith(88)

    await request(app.getHttpServer()).get('/game/88/download-source').expect(200)
    expect(gameDownloadSourceService.getByGameId).toHaveBeenCalledWith(
      88,
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )

    await request(app.getHttpServer()).get('/game/download/66/link?token=t-1').expect(200)
    expect(gameDownloadSourceService.getDownloadLink).toHaveBeenCalledWith(66, 't-1')

    await request(app.getHttpServer())
      .post('/game/88/download-source')
      .send({ title: 'mirror A' })
      .expect(201)
    expect(gameDownloadSourceService.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'mirror A' }),
      88,
      9001,
    )
  })

  it('returns 400 for invalid parse-int id params', async () => {
    await request(app.getHttpServer()).get('/game/not-a-number/header').expect(400)
    await request(app.getHttpServer()).get('/game/not-a-number/details').expect(400)
    await request(app.getHttpServer()).get('/game/not-a-number/characters').expect(400)
    await request(app.getHttpServer()).post('/game/not-a-number/view').expect(400)
    await request(app.getHttpServer()).get('/game/download/not-a-number/link?token=x').expect(400)
    await request(app.getHttpServer())
      .post('/game/not-a-number/download-source')
      .send({})
      .expect(400)

    expect(gameService.getHeader).not.toHaveBeenCalled()
    expect(gameDownloadSourceService.getDownloadLink).not.toHaveBeenCalled()
  })

  it('returns 403 when jwt guard denies create download-source endpoint', async () => {
    ;(jwtAuthGuard.canActivate as jest.Mock).mockReturnValueOnce(false)

    const res = await request(app.getHttpServer())
      .post('/game/88/download-source')
      .send({})
      .expect(403)

    expect(res.body.message).toBe('Forbidden resource')
    expect(gameDownloadSourceService.create).not.toHaveBeenCalled()
  })
})
