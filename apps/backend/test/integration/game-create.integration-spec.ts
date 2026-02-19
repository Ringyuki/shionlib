import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { requestId } from '../../src/common/middlewares/request-id.middleware'
import { GameCreateController } from '../../src/modules/game/controllers/game-create.controller'
import { GameDataFetcherService } from '../../src/modules/game/services/game-data-fetcher.service'
import { GameCreateService } from '../../src/modules/game/services/game-create.service'
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../src/modules/auth/guards/roles.guard'

describe('GameCreate (integration)', () => {
  let app: INestApplication

  const gameDataFetcherService = {
    fetchData: jest.fn(),
  }
  const gameCreateService = {
    createFromBangumiAndVNDB: jest.fn(),
    createGame: jest.fn(),
    createCover: jest.fn(),
    createCharacter: jest.fn(),
    createDeveloper: jest.fn(),
  }
  const jwtAuthGuard: CanActivate = {
    canActivate: jest.fn((context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest()
      req.user = { sub: 9001, role: 0, fid: 'family-1' }
      return true
    }),
  }
  const rolesGuard: CanActivate = {
    canActivate: jest.fn(() => true),
  }

  beforeAll(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [GameCreateController],
      providers: [
        { provide: GameDataFetcherService, useValue: gameDataFetcherService },
        { provide: GameCreateService, useValue: gameCreateService },
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

  it('covers fetch and create endpoints', async () => {
    gameDataFetcherService.fetchData.mockResolvedValueOnce({ b: {}, v: {} })
    gameCreateService.createFromBangumiAndVNDB.mockResolvedValueOnce({ id: 1 })
    gameCreateService.createGame.mockResolvedValueOnce({ id: 2 })
    gameCreateService.createCover.mockResolvedValueOnce({ id: 3 })
    gameCreateService.createCharacter.mockResolvedValueOnce({ id: 4 })
    gameCreateService.createDeveloper.mockResolvedValueOnce({ id: 5 })

    const fetchRes = await request(app.getHttpServer())
      .get('/game/create/fetch')
      .query({ b_id: '100', v_id: 'v200' })
      .expect(200)
    expect(fetchRes.headers['shionlib-request-id']).toBeDefined()
    expect(gameDataFetcherService.fetchData).toHaveBeenCalledWith('100', 'v200')

    await request(app.getHttpServer())
      .post('/game/create/frombv')
      .send({ b_id: 100, v_id: 200, skip_consistency_check: true })
      .expect(201)
    expect(gameCreateService.createFromBangumiAndVNDB).toHaveBeenCalledWith(
      '100',
      '200',
      true,
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )

    await request(app.getHttpServer()).post('/game/create/game').send({ title_zh: 'g' }).expect(201)
    expect(gameCreateService.createGame).toHaveBeenCalledWith(
      expect.objectContaining({ title_zh: 'g' }),
      9001,
    )

    await request(app.getHttpServer())
      .post('/game/create/10/cover')
      .send({ url: 'https://img' })
      .expect(201)
    expect(gameCreateService.createCover).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://img' }),
      10,
    )

    await request(app.getHttpServer())
      .post('/game/create/10/character')
      .send({ name_zh: 'char-a' })
      .expect(201)
    expect(gameCreateService.createCharacter).toHaveBeenCalledWith(
      expect.objectContaining({ name_zh: 'char-a' }),
      10,
    )

    await request(app.getHttpServer())
      .post('/game/create/10/developer')
      .send({ name: 'dev-a' })
      .expect(201)
    expect(gameCreateService.createDeveloper).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'dev-a' }),
      10,
    )
  })

  it('returns 400 for invalid game_id params', async () => {
    await request(app.getHttpServer())
      .post('/game/create/not-a-number/cover')
      .send({ url: 'x' })
      .expect(400)
    await request(app.getHttpServer())
      .post('/game/create/not-a-number/character')
      .send({})
      .expect(400)
    await request(app.getHttpServer())
      .post('/game/create/not-a-number/developer')
      .send({})
      .expect(400)
  })

  it('returns 403 when role guard denies access', async () => {
    ;(rolesGuard.canActivate as jest.Mock).mockReturnValueOnce(false)

    const res = await request(app.getHttpServer())
      .post('/game/create/game')
      .send({ title_zh: 'g' })
      .expect(403)

    expect(res.body.message).toBe('Forbidden resource')
    expect(gameCreateService.createGame).not.toHaveBeenCalled()
  })
})
