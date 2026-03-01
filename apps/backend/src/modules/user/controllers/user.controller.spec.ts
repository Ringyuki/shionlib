import { UserController } from './user.controller'

describe('UserController', () => {
  const createController = () => {
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
        if (key === 'token.expiresIn') return 7200
        if (key === 'refresh_token.shortWindowSec') return 604800
        return undefined
      }),
    }

    return {
      userService,
      configService,
      controller: new UserController(userService as any, configService as any),
    }
  }

  it('delegates create', async () => {
    const { controller, userService } = createController()
    const dto = { name: 'foo' }
    const request = { user: { sub: 'u1' } }

    await controller.create(dto as any, request as any)

    expect(userService.create).toHaveBeenCalledWith(dto, request)
  })

  it('login sets access and refresh cookies and returns accessTokenExp', async () => {
    const { controller, userService } = createController()
    const expDate = new Date('2026-06-01T00:00:00.000Z')
    userService.login.mockResolvedValue({
      token: 'access-token',
      refresh_token: 'refresh-token',
      tokenExp: expDate,
    })

    const response = { setHeader: jest.fn() }
    const loginDto = { identifier: 'a', password: 'b' }
    const request = { ip: '127.0.0.1' }

    const result = await controller.login(loginDto as any, request as any, response as any)

    expect(userService.login).toHaveBeenCalledWith(loginDto, request)
    expect(response.setHeader).toHaveBeenCalledTimes(1)
    const [headerName, cookies] = response.setHeader.mock.calls[0]
    expect(headerName).toBe('Set-Cookie')
    expect(cookies).toEqual(
      expect.arrayContaining([
        expect.stringContaining('shionlib_access_token=access-token'),
        expect.stringContaining('Max-Age=7200'),
        expect.stringContaining('shionlib_refresh_token=refresh-token'),
        expect.stringContaining('Max-Age=604800'),
      ]),
    )
    expect(result).toEqual({ accessTokenExp: expDate.getTime() })
  })

  it('login returns accessTokenExp when tokenExp is a serialized string (Redis deserialization)', async () => {
    const { controller, userService } = createController()
    const expIso = '2026-06-01T00:00:00.000Z'
    userService.login.mockResolvedValue({
      token: 'access-token',
      refresh_token: 'refresh-token',
      tokenExp: expIso,
    })
    const response = { setHeader: jest.fn() }

    const result = await controller.login(
      { identifier: 'a', password: 'b' } as any,
      { ip: '127.0.0.1' } as any,
      response as any,
    )

    expect(result).toEqual({ accessTokenExp: new Date(expIso).getTime() })
  })

  it('delegates getProfile', async () => {
    const { controller, userService } = createController()
    const request = { user: { sub: 'u2' } }

    await controller.getProfile(request as any)

    expect(userService.getMe).toHaveBeenCalledWith(request)
  })

  it('delegates getUser', async () => {
    const { controller, userService } = createController()

    await controller.getUser(12)

    expect(userService.getById).toHaveBeenCalledWith(12)
  })

  it('delegates checkName', async () => {
    const { controller, userService } = createController()

    await controller.checkName({ name: 'alice' })

    expect(userService.checkName).toHaveBeenCalledWith('alice')
  })

  it('delegates ban and unban', async () => {
    const { controller, userService } = createController()
    const dto = { reason: 'spam', days: 3 }

    await controller.ban(dto as any, 22)
    await controller.unban(22)

    expect(userService.ban).toHaveBeenCalledWith(22, dto)
    expect(userService.unban).toHaveBeenCalledWith(22)
  })
})
