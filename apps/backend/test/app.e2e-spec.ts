import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { HealthController } from '../src/modules/health/controllers/health.controller'
import { HealthService } from '../src/modules/health/services/health.service'
import { PrismaService } from '../src/prisma.service'
import { requestId } from '../src/common/middlewares/request-id.middleware'

describe('Health (e2e)', () => {
  let app: INestApplication
  const prismaMock = {
    $queryRaw: jest.fn(),
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService, { provide: PrismaService, useValue: prismaMock }],
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

  it('/health (GET) returns ok with request id header', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }])

    const res = await request(app.getHttpServer()).get('/health').expect(200)
    expect(res.headers['shionlib-request-id']).toBeDefined()
    expect(res.body.status).toBe('ok')
    expect(res.body.checks.db).toBe('up')
  })

  it('/health (GET) returns 503 when db is down', async () => {
    prismaMock.$queryRaw.mockRejectedValueOnce(new Error('db down'))

    const res = await request(app.getHttpServer()).get('/health').expect(503)
    expect(res.headers['shionlib-request-id']).toBeDefined()
    expect(res.body.status).toBe('error')
    expect(res.body.checks.db).toBe('down')
  })
})
