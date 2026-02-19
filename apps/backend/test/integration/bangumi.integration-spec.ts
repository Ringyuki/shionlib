import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { requestId } from '../../src/common/middlewares/request-id.middleware'
import { BangumiController } from '../../src/modules/bangumi/controllers/bangumi.controller'
import { BangumiAuthService } from '../../src/modules/bangumi/services/bangumi-auth.service'

describe('Bangumi (integration)', () => {
  let app: INestApplication

  const bangumiAuthService = {
    bangumiRequest: jest.fn(),
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [BangumiController],
      providers: [{ provide: BangumiAuthService, useValue: bangumiAuthService }],
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

  it('GET /bangumi/get uses default path and id', async () => {
    bangumiAuthService.bangumiRequest.mockResolvedValueOnce({ id: 42 })

    const res = await request(app.getHttpServer()).get('/bangumi/get').query({ id: 42 }).expect(200)

    expect(res.headers['shionlib-request-id']).toBeDefined()
    expect(res.body).toEqual({ id: 42 })
    expect(bangumiAuthService.bangumiRequest).toHaveBeenCalledWith(
      'https://api.bgm.tv/v0/subjects/42',
      'GET',
    )
  })

  it('GET /bangumi/get supports explicit path and type', async () => {
    bangumiAuthService.bangumiRequest.mockResolvedValueOnce({ ok: true })

    const res = await request(app.getHttpServer())
      .get('/bangumi/get')
      .query({ path: 'characters', id: 7, type: 'persons' })
      .expect(200)

    expect(res.body).toEqual({ ok: true })
    expect(bangumiAuthService.bangumiRequest).toHaveBeenCalledWith(
      'https://api.bgm.tv/v0/characters/7/persons',
      'GET',
    )
  })
})
