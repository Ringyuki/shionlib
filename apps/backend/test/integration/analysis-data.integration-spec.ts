import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { requestId } from '../../src/common/middlewares/request-id.middleware'
import { AnalysisDataController } from '../../src/modules/analysis/controllers/data.controller'
import { DataService } from '../../src/modules/analysis/services/data.service'
import { CacheService } from '../../src/modules/cache/services/cache.service'

describe('AnalysisData (integration)', () => {
  let app: INestApplication

  const dataService = {
    getOverview: jest.fn(),
  }
  const cacheService = {
    get: jest.fn(),
    set: jest.fn(),
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AnalysisDataController],
      providers: [
        { provide: DataService, useValue: dataService },
        { provide: CacheService, useValue: cacheService },
      ],
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

  it('GET /analysis/data/overview returns cached payload when cache hit', async () => {
    cacheService.get.mockResolvedValueOnce({ games: 1, files: 2 })

    const res = await request(app.getHttpServer()).get('/analysis/data/overview').expect(200)

    expect(res.headers['shionlib-request-id']).toBeDefined()
    expect(res.body).toEqual({ games: 1, files: 2 })
    expect(cacheService.get).toHaveBeenCalledWith('analysis:data:overview')
    expect(dataService.getOverview).not.toHaveBeenCalled()
    expect(cacheService.set).not.toHaveBeenCalled()
  })

  it('GET /analysis/data/overview fetches and writes cache on miss', async () => {
    cacheService.get.mockResolvedValueOnce(null)
    dataService.getOverview.mockResolvedValueOnce({ games: 3, files: 4, resources: 5 })

    const res = await request(app.getHttpServer()).get('/analysis/data/overview').expect(200)

    expect(res.body).toEqual({ games: 3, files: 4, resources: 5 })
    expect(dataService.getOverview).toHaveBeenCalledTimes(1)
    expect(cacheService.set).toHaveBeenCalledWith(
      'analysis:data:overview',
      { games: 3, files: 4, resources: 5 },
      30 * 60 * 1000,
    )
  })
})
