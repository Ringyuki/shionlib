import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { HealthController } from '../../src/modules/health/controllers/health.controller'
import { HealthService } from '../../src/modules/health/services/health.service'
import { PrismaService } from '../../src/prisma.service'
import { requestId } from '../../src/common/middlewares/request-id.middleware'

describe('Health (integration)', () => {
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

  it('returns ok when db is available', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }])

    const response = await request(app.getHttpServer()).get('/health').expect(200)

    expect(response.headers['shionlib-request-id']).toBeDefined()
    expect(response.body.status).toBe('ok')
    expect(response.body.checks.db).toBe('up')
    expect(typeof response.body.latencyMs).toBe('number')
  })

  it('returns 503 when db check fails', async () => {
    prismaMock.$queryRaw.mockRejectedValueOnce(new Error('db down'))

    const response = await request(app.getHttpServer()).get('/health').expect(503)
    expect(response.headers['shionlib-request-id']).toBeDefined()
    expect(response.body.status).toBe('error')
    expect(response.body.checks.db).toBe('down')
  })
})
