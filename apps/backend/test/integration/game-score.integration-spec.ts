import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { requestId } from '../../src/common/middlewares/request-id.middleware'
import { GameScoreController } from '../../src/modules/game/controllers/game-score.controller'
import { GameScoreService } from '../../src/modules/game/services/game-score.service'

describe('GameScore (integration)', () => {
  let app: INestApplication

  const gameScoreService = {
    getBangumiScore: jest.fn(),
    getVNDBScore: jest.fn(),
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [GameScoreController],
      providers: [{ provide: GameScoreService, useValue: gameScoreService }],
    }).compile()

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

  it('covers bangumi and vndb score endpoints', async () => {
    gameScoreService.getBangumiScore.mockResolvedValueOnce({ id: 100, rating: { score: 7.8 } })
    gameScoreService.getVNDBScore.mockResolvedValueOnce({
      rating: 80,
      average: 78,
      votecount: 1200,
    })

    const bRes = await request(app.getHttpServer()).get('/game/score/bangumi/10').expect(200)
    expect(bRes.headers['shionlib-request-id']).toBeDefined()
    expect(bRes.body).toEqual({ id: 100, rating: { score: 7.8 } })
    expect(gameScoreService.getBangumiScore).toHaveBeenCalledWith(10)

    const vRes = await request(app.getHttpServer()).get('/game/score/vndb/11').expect(200)
    expect(vRes.body).toEqual({ rating: 80, average: 78, votecount: 1200 })
    expect(gameScoreService.getVNDBScore).toHaveBeenCalledWith(11)
  })

  it('returns 400 for invalid id path params', async () => {
    await request(app.getHttpServer()).get('/game/score/bangumi/not-a-number').expect(400)
    await request(app.getHttpServer()).get('/game/score/vndb/not-a-number').expect(400)

    expect(gameScoreService.getBangumiScore).not.toHaveBeenCalled()
    expect(gameScoreService.getVNDBScore).not.toHaveBeenCalled()
  })
})
