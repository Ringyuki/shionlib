import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { requestId } from '../../src/common/middlewares/request-id.middleware'
import { UserDataController } from '../../src/modules/user/controllers/user-data.controller'
import { UserDataService } from '../../src/modules/user/services/user-data.service'

describe('UserData (integration)', () => {
  let app: INestApplication

  const userDataService = {
    getGameResources: jest.fn(),
    getComments: jest.fn(),
    getEditRecords: jest.fn(),
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [UserDataController],
      providers: [{ provide: UserDataService, useValue: userDataService }],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.use((req: any, _res: any, next: () => void) => {
      req.user = { sub: 9001, role: 0, fid: 'family-1' }
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

  it('covers user data list endpoints', async () => {
    userDataService.getGameResources.mockResolvedValueOnce({ items: [], meta: { totalItems: 0 } })
    userDataService.getComments.mockResolvedValueOnce({ items: [], meta: { totalItems: 0 } })
    userDataService.getEditRecords.mockResolvedValueOnce({ items: [], meta: { totalItems: 0 } })

    const resourcesRes = await request(app.getHttpServer())
      .get('/user/datas/11/game-resources')
      .query({ page: 2, pageSize: 10 })
      .expect(200)
    expect(resourcesRes.headers['shionlib-request-id']).toBeDefined()
    expect(userDataService.getGameResources).toHaveBeenCalledWith(
      11,
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
      expect.objectContaining({ page: '2', pageSize: '10' }),
    )

    await request(app.getHttpServer())
      .get('/user/datas/11/comments')
      .query({ page: 1, pageSize: 5 })
      .expect(200)
    expect(userDataService.getComments).toHaveBeenCalledWith(
      11,
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
      expect.objectContaining({ page: '1', pageSize: '5' }),
    )

    await request(app.getHttpServer())
      .get('/user/datas/11/edit-records')
      .query({ page: 3, pageSize: 20 })
      .expect(200)
    expect(userDataService.getEditRecords).toHaveBeenCalledWith(
      11,
      expect.objectContaining({ page: '3', pageSize: '20' }),
    )
  })

  it('returns 400 for invalid id path params', async () => {
    await request(app.getHttpServer()).get('/user/datas/not-a-number/game-resources').expect(400)
    await request(app.getHttpServer()).get('/user/datas/not-a-number/comments').expect(400)
    await request(app.getHttpServer()).get('/user/datas/not-a-number/edit-records').expect(400)
  })
})
