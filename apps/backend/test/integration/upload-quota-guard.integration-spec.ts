import { INestApplication } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import cookieParser from 'cookie-parser'
import { requestId } from '../../src/common/middlewares/request-id.middleware'
import { ShionConfigService } from '../../src/common/config/services/config.service'
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard'
import { CacheService } from '../../src/modules/cache/services/cache.service'
import { UploadQuotaController } from '../../src/modules/upload/controllers/upload-quota.controller'
import { UploadQuotaService } from '../../src/modules/upload/services/upload-quota.service'
import { ShionBizCode } from '../../src/shared/enums/biz-code/shion-biz-code.enum'

describe('UploadQuota Guard (integration)', () => {
  let app: INestApplication
  const uploadQuotaService = {
    getUploadQuota: jest.fn(),
  }
  const jwtService = {
    verifyAsync: jest.fn(),
  }
  const configService = {
    get: jest.fn(() => 'secret'),
  }
  const cacheService = {
    get: jest.fn(),
  }
  const reflector = {
    getAllAndOverride: jest.fn(() => false),
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [UploadQuotaController],
      providers: [
        UploadQuotaService,
        JwtAuthGuard,
        { provide: UploadQuotaService, useValue: uploadQuotaService },
        { provide: JwtService, useValue: jwtService },
        { provide: ShionConfigService, useValue: configService },
        { provide: CacheService, useValue: cacheService },
        { provide: Reflector, useValue: reflector },
      ],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.use(cookieParser())
    app.use(requestId())
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('GET /uploads/quota returns quota for authorized user from JWT payload', async () => {
    jwtService.verifyAsync.mockResolvedValueOnce({
      sub: 321,
      fid: 'family-1',
      role: 0,
    })
    cacheService.get.mockResolvedValueOnce(false)
    uploadQuotaService.getUploadQuota.mockResolvedValueOnce({
      size: 1000,
      used: 100,
    })

    const res = await request(app.getHttpServer())
      .get('/uploads/quota')
      .set('Authorization', 'Bearer token-1')
      .expect(200)

    expect(res.headers['shionlib-request-id']).toBeDefined()
    expect(res.body).toEqual({ size: 1000, used: 100 })
    expect(uploadQuotaService.getUploadQuota).toHaveBeenCalledWith(321)
  })

  it('GET /uploads/quota returns 401 when token is missing', async () => {
    const res = await request(app.getHttpServer()).get('/uploads/quota').expect(401)

    expect(res.headers['shionlib-request-id']).toBeDefined()
    expect(res.body.message).toBe('shion-biz.AUTH_UNAUTHORIZED')
    expect(uploadQuotaService.getUploadQuota).not.toHaveBeenCalled()
  })

  it('GET /uploads/quota returns 403 when token family is blocked', async () => {
    jwtService.verifyAsync.mockResolvedValueOnce({
      sub: 123,
      fid: 'family-2',
      role: 0,
    })
    cacheService.get.mockResolvedValueOnce(true)

    const res = await request(app.getHttpServer())
      .get('/uploads/quota')
      .set('Authorization', 'Bearer token-2')
      .expect(403)

    expect(res.headers['shionlib-request-id']).toBeDefined()
    expect(res.body.message).toBe('shion-biz.AUTH_FAMILY_BLOCKED')
    expect(uploadQuotaService.getUploadQuota).not.toHaveBeenCalled()
  })

  it('GET /uploads/quota returns 401 when token verification fails', async () => {
    jwtService.verifyAsync.mockRejectedValueOnce(new Error('invalid token'))

    const res = await request(app.getHttpServer())
      .get('/uploads/quota')
      .set('Authorization', 'Bearer bad-token')
      .expect(401)

    expect(res.body.message).toBe('shion-biz.AUTH_UNAUTHORIZED')
    expect(uploadQuotaService.getUploadQuota).not.toHaveBeenCalled()
    expect(cacheService.get).not.toHaveBeenCalled()
  })

  it('supports token from cookie when Authorization header is absent', async () => {
    jwtService.verifyAsync.mockResolvedValueOnce({
      sub: 88,
      fid: 'family-cookie',
      role: 0,
    })
    cacheService.get.mockResolvedValueOnce(false)
    uploadQuotaService.getUploadQuota.mockResolvedValueOnce({
      size: 42,
      used: 1,
    })

    const res = await request(app.getHttpServer())
      .get('/uploads/quota')
      .set('Cookie', 'shionlib_access_token=cookie-token')
      .expect(200)

    expect(uploadQuotaService.getUploadQuota).toHaveBeenCalledWith(88)
    expect(res.body).toEqual({ size: 42, used: 1 })
  })

  it('marks unauthorized with biz code semantics in body', async () => {
    const res = await request(app.getHttpServer()).get('/uploads/quota').expect(401)
    expect(res.body.message).toBe('shion-biz.AUTH_UNAUTHORIZED')
    expect(res.body.statusCode).toBe(401)
    expect(ShionBizCode.AUTH_UNAUTHORIZED).toBe(200101)
  })
})
