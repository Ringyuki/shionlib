import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { requestId } from '../../src/common/middlewares/request-id.middleware'
import { ActivityController } from '../../src/modules/activity/controllers/activity.controller'
import { ActivityService } from '../../src/modules/activity/services/activity.service'

describe('Activity (integration)', () => {
  let app: INestApplication
  const activityService = {
    getList: jest.fn(),
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ActivityController],
      providers: [{ provide: ActivityService, useValue: activityService }],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.use(requestId())
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('GET /activity/list forwards query and returns response body', async () => {
    activityService.getList.mockResolvedValueOnce({
      items: [{ id: 1, type: 'GAME_CREATED' }],
      meta: { totalItems: 1, itemCount: 1, itemsPerPage: 10, totalPages: 1, currentPage: 1 },
    })

    const res = await request(app.getHttpServer())
      .get('/activity/list')
      .query({ page: 2, pageSize: 20 })
      .expect(200)

    expect(res.headers['shionlib-request-id']).toBeDefined()
    expect(res.body).toEqual({
      items: [{ id: 1, type: 'GAME_CREATED' }],
      meta: { totalItems: 1, itemCount: 1, itemsPerPage: 10, totalPages: 1, currentPage: 1 },
    })
    expect(activityService.getList).toHaveBeenCalledTimes(1)
    expect(activityService.getList).toHaveBeenCalledWith(
      expect.objectContaining({ page: '2', pageSize: '20' }),
      expect.objectContaining({
        method: 'GET',
        url: '/activity/list?page=2&pageSize=20',
      }),
    )
  })

  it('GET /activity/list returns 500 when service throws', async () => {
    activityService.getList.mockRejectedValueOnce(new Error('boom'))

    const res = await request(app.getHttpServer()).get('/activity/list').expect(500)

    expect(res.headers['shionlib-request-id']).toBeDefined()
    expect(res.body).toEqual(
      expect.objectContaining({
        statusCode: 500,
        message: 'Internal server error',
      }),
    )
  })
})
