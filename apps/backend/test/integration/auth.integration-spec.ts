import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { requestId } from '../../src/common/middlewares/request-id.middleware'
import { ShionConfigService } from '../../src/common/config/services/config.service'
import { AuthController } from '../../src/modules/auth/controllers/auth.controller'
import { VerificationCodeController } from '../../src/modules/auth/controllers/verification-code.controller'
import { LoginSessionService } from '../../src/modules/auth/services/login-session.service'
import { PasswordService } from '../../src/modules/auth/services/password.service'
import { VerificationCodeService } from '../../src/modules/auth/services/vrification-code.service'
import { UserService } from '../../src/modules/user/services/user.service'

describe('Auth (integration)', () => {
  let app: INestApplication

  const userService = {
    refreshToken: jest.fn(),
  }
  const loginSessionService = {
    logout: jest.fn(),
  }
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'token.expiresIn') return 3600
      if (key === 'refresh_token.shortWindowSec') return 604800
      return undefined
    }),
  }
  const passwordService = {
    getEmail: jest.fn(),
    check: jest.fn(),
    resetPassword: jest.fn(),
  }
  const verificationCodeService = {
    request: jest.fn(),
    verify: jest.fn(),
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController, VerificationCodeController],
      providers: [
        { provide: UserService, useValue: userService },
        { provide: LoginSessionService, useValue: loginSessionService },
        { provide: ShionConfigService, useValue: configService },
        { provide: PasswordService, useValue: passwordService },
        { provide: VerificationCodeService, useValue: verificationCodeService },
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

  it('POST /auth/token/refresh sets renewed cookies from refresh token cookie', async () => {
    userService.refreshToken.mockResolvedValueOnce({
      token: 'access-token',
      refresh_token: 'refresh-token',
    })

    const res = await request(app.getHttpServer())
      .post('/auth/token/refresh')
      .set('Cookie', 'shionlib_refresh_token=old-refresh')
      .expect(201)

    expect(res.headers['shionlib-request-id']).toBeDefined()
    expect(userService.refreshToken).toHaveBeenCalledWith(
      'old-refresh',
      expect.objectContaining({
        cookies: expect.objectContaining({ shionlib_refresh_token: 'old-refresh' }),
      }),
    )
    expect(res.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('shionlib_access_token=access-token'),
        expect.stringContaining('Max-Age=3600'),
        expect.stringContaining('shionlib_refresh_token=refresh-token'),
        expect.stringContaining('Max-Age=604800'),
      ]),
    )
  })

  it('POST /auth/logout revokes session and clears auth cookies', async () => {
    loginSessionService.logout.mockResolvedValueOnce(undefined)

    const res = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', 'shionlib_refresh_token=refresh-token')
      .expect(200)

    expect(loginSessionService.logout).toHaveBeenCalledWith('refresh-token')
    expect(res.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('shionlib_access_token=;'),
        expect.stringContaining('Max-Age=0'),
        expect.stringContaining('shionlib_refresh_token=;'),
      ]),
    )
  })

  it('POST password flows dispatch to password service', async () => {
    passwordService.getEmail.mockResolvedValueOnce({ sent: true })
    passwordService.check.mockResolvedValueOnce({ valid: true })
    passwordService.resetPassword.mockResolvedValueOnce({ reset: true })

    const forgetRes = await request(app.getHttpServer())
      .post('/auth/password/forget')
      .send({ email: 'foo@example.com' })
      .expect(201)
    expect(forgetRes.body).toEqual({ sent: true })

    const checkRes = await request(app.getHttpServer())
      .post('/auth/password/forget/check')
      .send({ email: 'foo@example.com', code: '123456' })
      .expect(201)
    expect(checkRes.body).toEqual({ valid: true })

    const resetRes = await request(app.getHttpServer())
      .post('/auth/password/forget/reset')
      .send({ email: 'foo@example.com', code: '123456', password: 'new-password-123' })
      .expect(201)
    expect(resetRes.body).toEqual({ reset: true })
  })

  it('POST /auth/code/request and /auth/code/verify dispatch to verification service', async () => {
    verificationCodeService.request.mockResolvedValueOnce({ requested: true })
    verificationCodeService.verify.mockResolvedValueOnce({ verified: true })

    const requestRes = await request(app.getHttpServer())
      .post('/auth/code/request')
      .send({ email: 'foo@example.com', scene: 'reset-password' })
      .expect(201)
    expect(requestRes.body).toEqual({ requested: true })
    expect(verificationCodeService.request).toHaveBeenCalledWith('foo@example.com')

    const verifyRes = await request(app.getHttpServer())
      .post('/auth/code/verify')
      .send({ email: 'foo@example.com', code: '123456', scene: 'reset-password' })
      .expect(201)
    expect(verifyRes.body).toEqual({ verified: true })
    expect(verificationCodeService.verify).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'foo@example.com', code: '123456' }),
    )
  })
})
