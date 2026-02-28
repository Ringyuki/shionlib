import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { requestId } from '../../src/common/middlewares/request-id.middleware'
import { UserInfoController } from '../../src/modules/user/controllers/user-info.controller'
import { UserInfoService } from '../../src/modules/user/services/user-info.service'
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard'

describe('UserInfo (integration)', () => {
  let app: INestApplication

  const userInfoService = {
    updateAvatar: jest.fn(),
    updateCover: jest.fn(),
    updateName: jest.fn(),
    requestCode: jest.fn(),
    updateEmail: jest.fn(),
    updatePassword: jest.fn(),
    updateLang: jest.fn(),
    updateContentLimit: jest.fn(),
  }
  const jwtAuthGuard: CanActivate = {
    canActivate: jest.fn((context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest()
      req.user = { sub: 9001, role: 0, fid: 'family-1' }
      return true
    }),
  }

  beforeAll(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [UserInfoController],
      providers: [{ provide: UserInfoService, useValue: userInfoService }],
    })
    moduleBuilder.overrideGuard(JwtAuthGuard).useValue(jwtAuthGuard)
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

  it('POST /user/info/avatar accepts image upload and delegates to service', async () => {
    userInfoService.updateAvatar.mockResolvedValueOnce({ updated: true })

    const res = await request(app.getHttpServer())
      .post('/user/info/avatar')
      .attach('avatar', Buffer.from('fake-image'), {
        filename: 'avatar.png',
        contentType: 'image/png',
      })
      .expect(201)

    expect(res.headers['shionlib-request-id']).toBeDefined()
    expect(res.body).toEqual({ updated: true })
    expect(userInfoService.updateAvatar).toHaveBeenCalledWith(
      expect.objectContaining({ mimetype: 'image/png', originalname: 'avatar.png' }),
      9001,
    )
  })

  it('POST /user/info/avatar rejects unsupported mime types', async () => {
    await request(app.getHttpServer())
      .post('/user/info/avatar')
      .attach('avatar', Buffer.from('text-file'), {
        filename: 'avatar.txt',
        contentType: 'text/plain',
      })
      .expect(415)

    expect(userInfoService.updateAvatar).not.toHaveBeenCalled()
  })

  it('covers profile info update endpoints', async () => {
    userInfoService.updateCover.mockResolvedValueOnce({ updated: true })
    userInfoService.updateName.mockResolvedValueOnce({ updated: true })
    userInfoService.requestCode.mockResolvedValueOnce({ sent: true })
    userInfoService.updateEmail.mockResolvedValueOnce({ updated: true })
    userInfoService.updatePassword.mockResolvedValueOnce({ updated: true })
    userInfoService.updateLang.mockResolvedValueOnce({ updated: true })
    userInfoService.updateContentLimit.mockResolvedValueOnce({ updated: true })

    await request(app.getHttpServer())
      .post('/user/info/cover')
      .attach('cover', Buffer.from('fake-image'), {
        filename: 'cover.png',
        contentType: 'image/png',
      })
      .expect(201)
    expect(userInfoService.updateCover).toHaveBeenCalledWith(
      expect.objectContaining({ mimetype: 'image/png', originalname: 'cover.png' }),
      9001,
    )

    await request(app.getHttpServer()).post('/user/info/name').send({ name: 'alice' }).expect(201)
    expect(userInfoService.updateName).toHaveBeenCalledWith('alice', 9001)

    await request(app.getHttpServer()).post('/user/info/email/request').expect(201)
    expect(userInfoService.requestCode).toHaveBeenCalledWith(9001)

    await request(app.getHttpServer())
      .post('/user/info/email')
      .send({ email: 'a@example.com', code: '123456' })
      .expect(201)
    expect(userInfoService.updateEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'a@example.com', code: '123456' }),
      9001,
    )

    await request(app.getHttpServer())
      .post('/user/info/password')
      .send({ password: 'new-pass', old_password: 'old-pass' })
      .expect(201)
    expect(userInfoService.updatePassword).toHaveBeenCalledWith('new-pass', 'old-pass', 9001)

    await request(app.getHttpServer()).post('/user/info/lang').send({ lang: 'ja' }).expect(201)
    expect(userInfoService.updateLang).toHaveBeenCalledWith('ja', 9001)

    await request(app.getHttpServer())
      .post('/user/info/content-limit')
      .send({ content_limit: 2 })
      .expect(201)
    expect(userInfoService.updateContentLimit).toHaveBeenCalledWith(2, 9001)
  })

  it('returns 403 when auth guard denies access', async () => {
    ;(jwtAuthGuard.canActivate as jest.Mock).mockReturnValueOnce(false)

    const res = await request(app.getHttpServer())
      .post('/user/info/name')
      .send({ name: 'x' })
      .expect(403)

    expect(res.body.message).toBe('Forbidden resource')
    expect(userInfoService.updateName).not.toHaveBeenCalled()
  })
})
