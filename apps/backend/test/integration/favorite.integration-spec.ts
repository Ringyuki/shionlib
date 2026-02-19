import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { requestId } from '../../src/common/middlewares/request-id.middleware'
import { FavoriteController } from '../../src/modules/favorite/controllers/favorite.controller'
import { FavoriteService } from '../../src/modules/favorite/services/favorite.service'
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard'

describe('Favorite (integration)', () => {
  let app: INestApplication

  const favoriteService = {
    createFavorite: jest.fn(),
    addGameToFavorite: jest.fn(),
    updateFavorite: jest.fn(),
    deleteFavorite: jest.fn(),
    updateFavoriteItem: jest.fn(),
    deleteFavoriteItem: jest.fn(),
    deleteFavoriteItemByGameId: jest.fn(),
    getFavorites: jest.fn(),
    getFavoriteItems: jest.fn(),
    getFavoriteStats: jest.fn(),
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
      controllers: [FavoriteController],
      providers: [{ provide: FavoriteService, useValue: favoriteService }],
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

  it('covers favorite CRUD and item mutation endpoints', async () => {
    favoriteService.createFavorite.mockResolvedValueOnce({ id: 1 })
    favoriteService.addGameToFavorite.mockResolvedValueOnce({ id: 2 })
    favoriteService.updateFavorite.mockResolvedValueOnce({ id: 1, updated: true })
    favoriteService.deleteFavorite.mockResolvedValueOnce({ deleted: true })
    favoriteService.updateFavoriteItem.mockResolvedValueOnce({ updated: true })
    favoriteService.deleteFavoriteItem.mockResolvedValueOnce({ deleted: true })
    favoriteService.deleteFavoriteItemByGameId.mockResolvedValueOnce({ deleted: true })

    await request(app.getHttpServer()).post('/favorites').send({ name: 'mine' }).expect(201)
    expect(favoriteService.createFavorite).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'mine' }),
      9001,
    )

    await request(app.getHttpServer()).put('/favorites/1').send({ game_id: 100 }).expect(200)
    expect(favoriteService.addGameToFavorite).toHaveBeenCalledWith(
      1,
      9001,
      expect.objectContaining({ game_id: 100 }),
    )

    await request(app.getHttpServer()).patch('/favorites/1').send({ name: 'new-name' }).expect(200)
    expect(favoriteService.updateFavorite).toHaveBeenCalledWith(
      1,
      9001,
      expect.objectContaining({ name: 'new-name' }),
    )

    await request(app.getHttpServer()).delete('/favorites/1').expect(200)
    expect(favoriteService.deleteFavorite).toHaveBeenCalledWith(1, 9001)

    await request(app.getHttpServer())
      .patch('/favorites/items/2')
      .send({ note: 'memo' })
      .expect(200)
    expect(favoriteService.updateFavoriteItem).toHaveBeenCalledWith(
      2,
      9001,
      expect.objectContaining({ note: 'memo' }),
    )

    await request(app.getHttpServer()).delete('/favorites/items/2').expect(200)
    expect(favoriteService.deleteFavoriteItem).toHaveBeenCalledWith(2, 9001)

    await request(app.getHttpServer()).delete('/favorites/1/games/100').expect(200)
    expect(favoriteService.deleteFavoriteItemByGameId).toHaveBeenCalledWith(1, 100, 9001)
  })

  it('covers favorites query endpoints', async () => {
    favoriteService.getFavorites.mockResolvedValueOnce({ items: [], meta: { totalItems: 0 } })
    favoriteService.getFavoriteItems.mockResolvedValueOnce({ items: [], meta: { totalItems: 0 } })
    favoriteService.getFavoriteStats.mockResolvedValueOnce({ total: 10, favored: false })

    const listRes = await request(app.getHttpServer())
      .get('/favorites')
      .query({ page: 2, pageSize: 10 })
      .expect(200)
    expect(listRes.headers['shionlib-request-id']).toBeDefined()
    expect(favoriteService.getFavorites).toHaveBeenCalledWith(
      9001,
      expect.objectContaining({ page: '2', pageSize: '10' }),
    )

    await request(app.getHttpServer())
      .get('/favorites/1/items')
      .query({ page: 1, pageSize: 5 })
      .expect(200)
    expect(favoriteService.getFavoriteItems).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ page: '1', pageSize: '5' }),
      expect.any(Object),
    )

    await request(app.getHttpServer()).get('/favorites/game/100/stats').expect(200)
    expect(favoriteService.getFavoriteStats).toHaveBeenCalledWith(9001, 100)
  })

  it('returns 400 for invalid id path params', async () => {
    await request(app.getHttpServer())
      .put('/favorites/not-a-number')
      .send({ game_id: 1 })
      .expect(400)
    await request(app.getHttpServer())
      .patch('/favorites/not-a-number')
      .send({ name: 'x' })
      .expect(400)
    await request(app.getHttpServer()).delete('/favorites/not-a-number').expect(400)
    await request(app.getHttpServer())
      .patch('/favorites/items/not-a-number')
      .send({ note: 'x' })
      .expect(400)
    await request(app.getHttpServer()).delete('/favorites/items/not-a-number').expect(400)
    await request(app.getHttpServer()).delete('/favorites/not-a-number/games/1').expect(400)
    await request(app.getHttpServer()).delete('/favorites/1/games/not-a-number').expect(400)
    await request(app.getHttpServer()).get('/favorites/not-a-number/items').expect(400)
    await request(app.getHttpServer()).get('/favorites/game/not-a-number/stats').expect(400)
  })

  it('returns 403 when auth guard denies access', async () => {
    ;(jwtAuthGuard.canActivate as jest.Mock).mockReturnValueOnce(false)

    const res = await request(app.getHttpServer())
      .post('/favorites')
      .send({ name: 'mine' })
      .expect(403)

    expect(res.body.message).toBe('Forbidden resource')
    expect(favoriteService.createFavorite).not.toHaveBeenCalled()
  })
})
