import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { requestId } from '../src/common/middlewares/request-id.middleware'
import { ShionConfigService } from '../src/common/config/services/config.service'
import { AuthController } from '../src/modules/auth/controllers/auth.controller'
import { LoginSessionService } from '../src/modules/auth/services/login-session.service'
import { PasswordService } from '../src/modules/auth/services/password.service'
import { UserService } from '../src/modules/user/services/user.service'

describe('Auth (e2e)', () => {
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

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: UserService, useValue: userService },
        { provide: LoginSessionService, useValue: loginSessionService },
        { provide: ShionConfigService, useValue: configService },
        { provide: PasswordService, useValue: passwordService },
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

  it('/auth/token/refresh (POST) should renew cookies', async () => {
    userService.refreshToken.mockResolvedValueOnce({
      token: 'access-token',
      refresh_token: 'refresh-token',
    })

    const res = await request(app.getHttpServer())
      .post('/auth/token/refresh')
      .set('Cookie', 'shionlib_refresh_token=old-refresh')
      .expect(201)

    expect(res.headers['shionlib-request-id']).toBeDefined()
    expect(res.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('shionlib_access_token=access-token'),
        expect.stringContaining('shionlib_refresh_token=refresh-token'),
      ]),
    )
  })

  it('/auth/logout (POST) should revoke session and clear cookies', async () => {
    loginSessionService.logout.mockResolvedValueOnce(undefined)

    const res = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', 'shionlib_refresh_token=refresh-token')
      .expect(200)

    expect(loginSessionService.logout).toHaveBeenCalledWith('refresh-token')
    expect(res.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('shionlib_access_token=;'),
        expect.stringContaining('shionlib_refresh_token=;'),
      ]),
    )
  })
})
