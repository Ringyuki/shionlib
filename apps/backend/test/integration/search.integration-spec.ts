import { INestApplication } from '@nestjs/common'
import { getQueueToken } from '@nestjs/bull'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { requestId } from '../../src/common/middlewares/request-id.middleware'
import { SearchController } from '../../src/modules/search/controllers/search.controller'
import { SearchService } from '../../src/modules/search/services/search.service'
import { SearchAnalyticsService } from '../../src/modules/search/services/analytics.service'
import {
  SEARCH_ANALYTICS_QUEUE,
  SUGG_PREFIX_MIN_LENGTH,
} from '../../src/modules/search/constants/analytics'

describe('Search (integration)', () => {
  let app: INestApplication

  const searchService = {
    searchGames: jest.fn(),
    searchGameTags: jest.fn(),
  }
  const analyticsService = {
    getTrends: jest.fn(),
    getSuggestions: jest.fn(),
  }
  const analyticsQueue = {
    add: jest.fn(),
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [
        { provide: SearchService, useValue: searchService },
        { provide: SearchAnalyticsService, useValue: analyticsService },
        { provide: getQueueToken(SEARCH_ANALYTICS_QUEUE), useValue: analyticsQueue },
      ],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.use((req: any, _res: any, next: () => void) => {
      req.user = { sub: 9001, content_limit: 3 }
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

  it('GET /search/games enqueues analytics when query length is enough', async () => {
    const q = 'x'.repeat(SUGG_PREFIX_MIN_LENGTH)
    searchService.searchGames.mockResolvedValueOnce({ items: [{ id: 1 }], total: 1 })

    const res = await request(app.getHttpServer())
      .get('/search/games')
      .query({ q, page: 1, pageSize: 10 })
      .expect(200)

    expect(res.headers['shionlib-request-id']).toBeDefined()
    expect(res.body).toEqual({ items: [{ id: 1 }], total: 1 })
    expect(analyticsQueue.add).toHaveBeenCalledWith(SEARCH_ANALYTICS_QUEUE, q)
    expect(searchService.searchGames).toHaveBeenCalledWith(
      expect.objectContaining({ q, page: '1', pageSize: '10' }),
      3,
    )
  })

  it('GET /search/games skips queue for short query', async () => {
    searchService.searchGames.mockResolvedValueOnce({ items: [], total: 0 })

    await request(app.getHttpServer()).get('/search/games').query({ page: 1 }).expect(200)

    expect(analyticsQueue.add).not.toHaveBeenCalled()
    expect(searchService.searchGames).toHaveBeenCalledWith(
      expect.objectContaining({ page: '1' }),
      3,
    )
  })

  it('covers tags, trending and suggest endpoints', async () => {
    searchService.searchGameTags.mockResolvedValueOnce(['tag1'])
    analyticsService.getTrends.mockResolvedValueOnce(['trend1'])
    analyticsService.getTrends.mockResolvedValueOnce(['trend2'])
    analyticsService.getSuggestions.mockResolvedValueOnce(['s1'])

    const tagsRes = await request(app.getHttpServer())
      .get('/search/tags')
      .query({ q: 'romance', limit: 5 })
      .expect(200)
    expect(tagsRes.body).toEqual(['tag1'])
    expect(searchService.searchGameTags).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'romance', limit: '5' }),
    )

    await request(app.getHttpServer()).get('/search/trending').query({ limit: 5 }).expect(200)
    expect(analyticsService.getTrends).toHaveBeenNthCalledWith(1, '5', undefined)

    await request(app.getHttpServer())
      .get('/search/trending')
      .query({ limit: 3, window: 60 })
      .expect(200)
    expect(analyticsService.getTrends).toHaveBeenNthCalledWith(2, '3', ['60'])

    const suggRes = await request(app.getHttpServer())
      .get('/search/suggest')
      .query({ prefix: 'ro', limit: 8 })
      .expect(200)
    expect(suggRes.body).toEqual(['s1'])
    expect(analyticsService.getSuggestions).toHaveBeenCalledWith('ro', '8')
  })
})
