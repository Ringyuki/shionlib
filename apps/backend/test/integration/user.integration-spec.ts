import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { requestId } from '../../src/common/middlewares/request-id.middleware'
import { UserController } from '../../src/modules/user/controllers/user.controller'
import { UserService } from '../../src/modules/user/services/user.service'
import { ShionConfigService } from '../../src/common/config/services/config.service'
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../src/modules/auth/guards/roles.guard'

describe('User (integration)', () => {
  let app: INestApplication

  const userService = {
    create: jest.fn(),
    login: jest.fn(),
    getMe: jest.fn(),
    getById: jest.fn(),
    checkName: jest.fn(),
    ban: jest.fn(),
    unban: jest.fn(),
  }
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'token.expiresIn') return 3600
      if (key === 'refresh_token.shortWindowSec') return 604800
      return undefined
    }),
  }
  const jwtAuthGuard: CanActivate = {
    canActivate: jest.fn((context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest()
      req.user = { sub: 9001, role: 99, fid: 'admin-family' }
      return true
    }),
  }
  const rolesGuard: CanActivate = {
    canActivate: jest.fn(() => true),
  }

  beforeAll(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [UserController],
      providers: [
        { provide: UserService, useValue: userService },
        { provide: ShionConfigService, useValue: configService },
      ],
    })
    moduleBuilder.overrideGuard(JwtAuthGuard).useValue(jwtAuthGuard)
    moduleBuilder.overrideGuard(RolesGuard).useValue(rolesGuard)
    const moduleFixture: TestingModule = await moduleBuilder.compile()

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

  it('covers create/login/get-user/check-name endpoints', async () => {
    userService.create.mockResolvedValueOnce({ id: 1 })
    userService.login.mockResolvedValueOnce({
      token: 'access-token',
      refresh_token: 'refresh-token',
    })
    userService.getById.mockResolvedValueOnce({ id: 2 })
    userService.checkName.mockResolvedValueOnce({ ok: true })

    const createRes = await request(app.getHttpServer())
      .post('/user')
      .send({ name: 'alice', password: 'pw' })
      .expect(201)
    expect(createRes.headers['shionlib-request-id']).toBeDefined()
    expect(userService.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'alice' }),
      expect.any(Object),
    )

    const loginRes = await request(app.getHttpServer())
      .post('/user/login')
      .send({ identifier: 'alice', password: 'pw' })
      .expect(201)
    expect(userService.login).toHaveBeenCalledWith(
      expect.objectContaining({ identifier: 'alice', password: 'pw' }),
      expect.any(Object),
    )
    expect(loginRes.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('shionlib_access_token=access-token'),
        expect.stringContaining('Max-Age=3600'),
        expect.stringContaining('shionlib_refresh_token=refresh-token'),
        expect.stringContaining('Max-Age=604800'),
      ]),
    )

    const userRes = await request(app.getHttpServer()).get('/user/2').expect(200)
    expect(userRes.body).toEqual({ id: 2 })
    expect(userService.getById).toHaveBeenCalledWith(2)

    const checkRes = await request(app.getHttpServer())
      .post('/user/check-name')
      .send({ name: 'alice' })
      .expect(201)
    expect(checkRes.body).toEqual({ ok: true })
    expect(userService.checkName).toHaveBeenCalledWith('alice')
  })

  it('covers guarded me/ban/unban endpoints', async () => {
    userService.getMe.mockResolvedValueOnce({ id: 9001 })
    userService.ban.mockResolvedValueOnce({ banned: true })
    userService.unban.mockResolvedValueOnce({ unbanned: true })

    const meRes = await request(app.getHttpServer()).get('/user/me').expect(200)
    expect(meRes.body).toEqual({ id: 9001 })
    expect(userService.getMe).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )

    await request(app.getHttpServer())
      .post('/user/8/ban')
      .send({ reason: 'spam', days: 3 })
      .expect(201)
    expect(userService.ban).toHaveBeenCalledWith(
      8,
      expect.objectContaining({ reason: 'spam', days: 3 }),
    )

    await request(app.getHttpServer()).post('/user/8/unban').expect(201)
    expect(userService.unban).toHaveBeenCalledWith(8)
  })

  it('returns 400 for invalid id path params', async () => {
    await request(app.getHttpServer()).get('/user/not-a-number').expect(400)
    await request(app.getHttpServer())
      .post('/user/not-a-number/ban')
      .send({ reason: 'x' })
      .expect(400)
    await request(app.getHttpServer()).post('/user/not-a-number/unban').expect(400)
  })

  it('returns 403 when guards deny access', async () => {
    ;(jwtAuthGuard.canActivate as jest.Mock).mockReturnValueOnce(false)
    await request(app.getHttpServer()).get('/user/me').expect(403)
    ;(rolesGuard.canActivate as jest.Mock).mockReturnValueOnce(false)
    const res = await request(app.getHttpServer())
      .post('/user/8/ban')
      .send({ reason: 'x' })
      .expect(403)
    expect(res.body.message).toBe('Forbidden resource')
  })
})
