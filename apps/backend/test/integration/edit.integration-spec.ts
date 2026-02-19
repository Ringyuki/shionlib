import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { requestId } from '../../src/common/middlewares/request-id.middleware'
import { EditController } from '../../src/modules/edit/controllers/edit.controller'
import { DataService } from '../../src/modules/edit/services/data.service'
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard'

describe('Edit (integration)', () => {
  let app: INestApplication

  const dataService = {
    getGameScalar: jest.fn(),
    getGameCover: jest.fn(),
    getGameImage: jest.fn(),
    getGameDevelopers: jest.fn(),
    getGameCharacters: jest.fn(),
    getGameEditHistory: jest.fn(),
    getDeveloperScalar: jest.fn(),
    getDeveloperEditHistory: jest.fn(),
    getCharacterScalar: jest.fn(),
    getCharacterEditHistory: jest.fn(),
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
      controllers: [EditController],
      providers: [{ provide: DataService, useValue: dataService }],
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

  it('covers guarded game scalar/detail endpoints', async () => {
    dataService.getGameScalar.mockResolvedValueOnce({ id: 1 })
    dataService.getGameCover.mockResolvedValueOnce([{ id: 11 }])
    dataService.getGameImage.mockResolvedValueOnce([{ id: 12 }])
    dataService.getGameDevelopers.mockResolvedValueOnce([{ id: 13 }])
    dataService.getGameCharacters.mockResolvedValueOnce([{ id: 14 }])

    await request(app.getHttpServer()).get('/edit/game/1/scalar').expect(200)
    await request(app.getHttpServer()).get('/edit/game/1/cover').expect(200)
    await request(app.getHttpServer()).get('/edit/game/1/image').expect(200)
    await request(app.getHttpServer()).get('/edit/game/1/developers').expect(200)
    await request(app.getHttpServer()).get('/edit/game/1/characters').expect(200)

    expect(dataService.getGameScalar).toHaveBeenCalledWith(1)
    expect(dataService.getGameCover).toHaveBeenCalledWith(1)
    expect(dataService.getGameImage).toHaveBeenCalledWith(1)
    expect(dataService.getGameDevelopers).toHaveBeenCalledWith(1)
    expect(dataService.getGameCharacters).toHaveBeenCalledWith(1)
  })

  it('covers history endpoints and scalar endpoints for developer/character', async () => {
    dataService.getGameEditHistory.mockResolvedValueOnce({ items: [], meta: { totalItems: 0 } })
    dataService.getDeveloperEditHistory.mockResolvedValueOnce({
      items: [],
      meta: { totalItems: 0 },
    })
    dataService.getCharacterEditHistory.mockResolvedValueOnce({
      items: [],
      meta: { totalItems: 0 },
    })
    dataService.getDeveloperScalar.mockResolvedValueOnce({ id: 2 })
    dataService.getCharacterScalar.mockResolvedValueOnce({ id: 3 })

    const gameHistoryRes = await request(app.getHttpServer())
      .get('/edit/game/1/history')
      .query({ page: 2, pageSize: 10 })
      .expect(200)
    expect(gameHistoryRes.headers['shionlib-request-id']).toBeDefined()

    await request(app.getHttpServer())
      .get('/edit/developer/2/history')
      .query({ page: 1, pageSize: 5 })
      .expect(200)
    await request(app.getHttpServer())
      .get('/edit/character/3/history')
      .query({ page: 3, pageSize: 7 })
      .expect(200)
    await request(app.getHttpServer()).get('/edit/developer/2/scalar').expect(200)
    await request(app.getHttpServer()).get('/edit/character/3/scalar').expect(200)

    expect(dataService.getGameEditHistory).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ page: '2', pageSize: '10' }),
    )
    expect(dataService.getDeveloperEditHistory).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ page: '1', pageSize: '5' }),
    )
    expect(dataService.getCharacterEditHistory).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ page: '3', pageSize: '7' }),
    )
    expect(dataService.getDeveloperScalar).toHaveBeenCalledWith(2)
    expect(dataService.getCharacterScalar).toHaveBeenCalledWith(3)
  })

  it('returns 400 for invalid id path params', async () => {
    await request(app.getHttpServer()).get('/edit/game/not-a-number/scalar').expect(400)
    await request(app.getHttpServer()).get('/edit/game/not-a-number/history').expect(400)
    await request(app.getHttpServer()).get('/edit/developer/not-a-number/scalar').expect(400)
    await request(app.getHttpServer()).get('/edit/developer/not-a-number/history').expect(400)
    await request(app.getHttpServer()).get('/edit/character/not-a-number/scalar').expect(400)
    await request(app.getHttpServer()).get('/edit/character/not-a-number/history').expect(400)
  })

  it('returns 403 when auth guard denies guarded endpoint', async () => {
    ;(jwtAuthGuard.canActivate as jest.Mock).mockReturnValueOnce(false)

    const res = await request(app.getHttpServer()).get('/edit/game/1/scalar').expect(403)

    expect(res.body.message).toBe('Forbidden resource')
    expect(dataService.getGameScalar).not.toHaveBeenCalled()
  })
})
