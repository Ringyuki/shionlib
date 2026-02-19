import { INestApplication } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { Test, TestingModule } from '@nestjs/testing'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { requestId } from '../../src/common/middlewares/request-id.middleware'
import { ShionConfigService } from '../../src/common/config/services/config.service'
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard'
import { CacheService } from '../../src/modules/cache/services/cache.service'
import { MessageController } from '../../src/modules/message/controllers/message.controller'
import { MessageService } from '../../src/modules/message/services/message.service'

describe('Message (integration)', () => {
  let app: INestApplication

  const messageService = {
    getList: jest.fn(),
    getUnreadCount: jest.fn(),
    getById: jest.fn(),
    markAllAsRead: jest.fn(),
    markAllAsUnread: jest.fn(),
    markAsRead: jest.fn(),
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
      controllers: [MessageController],
      providers: [
        MessageService,
        JwtAuthGuard,
        { provide: MessageService, useValue: messageService },
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

  beforeEach(() => {
    jest.clearAllMocks()
    jwtService.verifyAsync.mockResolvedValue({
      sub: 7,
      fid: 'family-7',
      role: 0,
    })
    cacheService.get.mockResolvedValue(false)
  })

  it('GET /message/list forwards query and authenticated user', async () => {
    messageService.getList.mockResolvedValueOnce({ items: [], total: 0 })

    const res = await request(app.getHttpServer())
      .get('/message/list')
      .set('Authorization', 'Bearer token')
      .query({ page: 2, pageSize: 10, unread: true, type: 'SYSTEM' })
      .expect(200)

    expect(res.headers['shionlib-request-id']).toBeDefined()
    expect(res.body).toEqual({ items: [], total: 0 })
    expect(messageService.getList).toHaveBeenCalledTimes(1)
    expect(messageService.getList.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        page: '2',
        pageSize: '10',
        unread: 'true',
        type: 'SYSTEM',
      }),
    )
    expect(messageService.getList.mock.calls[0][1].user.sub).toBe(7)
  })

  it('GET /message/unread works with cookie token fallback', async () => {
    jwtService.verifyAsync.mockResolvedValueOnce({
      sub: 88,
      fid: 'family-cookie',
      role: 0,
    })
    messageService.getUnreadCount.mockResolvedValueOnce({ unread: 5 })

    const res = await request(app.getHttpServer())
      .get('/message/unread')
      .set('Cookie', 'shionlib_access_token=cookie-token')
      .expect(200)

    expect(res.body).toEqual({ unread: 5 })
    expect(messageService.getUnreadCount).toHaveBeenCalledTimes(1)
    expect(messageService.getUnreadCount.mock.calls[0][0].user.sub).toBe(88)
  })

  it('GET /message/:id and POST read endpoints dispatch correctly', async () => {
    messageService.getById.mockResolvedValueOnce({ id: 42 })
    messageService.markAllAsRead.mockResolvedValueOnce({ updated: 3 })
    messageService.markAllAsUnread.mockResolvedValueOnce({ updated: 3 })
    messageService.markAsRead.mockResolvedValueOnce({ id: 42, read: true })

    const getRes = await request(app.getHttpServer())
      .get('/message/42')
      .set('Authorization', 'Bearer token')
      .expect(200)
    expect(getRes.body).toEqual({ id: 42 })

    const allReadRes = await request(app.getHttpServer())
      .post('/message/all/read')
      .set('Authorization', 'Bearer token')
      .expect(201)
    expect(allReadRes.body).toEqual({ updated: 3 })

    const allUnreadRes = await request(app.getHttpServer())
      .post('/message/all/unread')
      .set('Authorization', 'Bearer token')
      .expect(201)
    expect(allUnreadRes.body).toEqual({ updated: 3 })

    const markReadRes = await request(app.getHttpServer())
      .post('/message/42/read')
      .set('Authorization', 'Bearer token')
      .expect(201)
    expect(markReadRes.body).toEqual({ id: 42, read: true })

    expect(messageService.getById).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ user: expect.objectContaining({ sub: 7 }) }),
    )
    expect(messageService.markAllAsRead).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.objectContaining({ sub: 7 }) }),
    )
    expect(messageService.markAllAsUnread).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.objectContaining({ sub: 7 }) }),
    )
    expect(messageService.markAsRead).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ user: expect.objectContaining({ sub: 7 }) }),
    )
  })

  it('returns 400 for invalid message id path params', async () => {
    await request(app.getHttpServer())
      .get('/message/not-a-number')
      .set('Authorization', 'Bearer token')
      .expect(400)
    await request(app.getHttpServer())
      .post('/message/not-a-number/read')
      .set('Authorization', 'Bearer token')
      .expect(400)

    expect(messageService.getById).not.toHaveBeenCalled()
    expect(messageService.markAsRead).not.toHaveBeenCalled()
  })

  it('returns 401 when token is missing', async () => {
    const res = await request(app.getHttpServer()).get('/message/unread').expect(401)

    expect(res.body.message).toBe('shion-biz.AUTH_UNAUTHORIZED')
    expect(messageService.getUnreadCount).not.toHaveBeenCalled()
  })

  it('returns 403 when token family is blocked', async () => {
    cacheService.get.mockResolvedValueOnce(true)

    const res = await request(app.getHttpServer())
      .get('/message/unread')
      .set('Authorization', 'Bearer token')
      .expect(403)

    expect(res.body.message).toBe('shion-biz.AUTH_FAMILY_BLOCKED')
    expect(messageService.getUnreadCount).not.toHaveBeenCalled()
  })
})
