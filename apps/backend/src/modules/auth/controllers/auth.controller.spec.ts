import { AuthController } from './auth.controller'

describe('AuthController', () => {
  const createController = () => {
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

    return {
      userService,
      loginSessionService,
      configService,
      passwordService,
      controller: new AuthController(
        userService as any,
        loginSessionService as any,
        configService as any,
        passwordService as any,
      ),
    }
  }

  it('refreshToken refreshes token pair and sets cookies', async () => {
    const { controller, userService } = createController()
    userService.refreshToken.mockResolvedValue({
      token: 'access-token',
      refresh_token: 'refresh-token',
    })
    const request = { cookies: { shionlib_refresh_token: 'old-refresh' } }
    const response = { setHeader: jest.fn() }

    await controller.refreshToken(request as any, response as any)

    expect(userService.refreshToken).toHaveBeenCalledWith('old-refresh', request)
    expect(response.setHeader).toHaveBeenCalledTimes(1)
    const [headerName, cookies] = response.setHeader.mock.calls[0]
    expect(headerName).toBe('Set-Cookie')
    expect(cookies).toEqual(
      expect.arrayContaining([
        expect.stringContaining('shionlib_access_token=access-token'),
        expect.stringContaining('Max-Age=3600'),
        expect.stringContaining('shionlib_refresh_token=refresh-token'),
        expect.stringContaining('Max-Age=604800'),
      ]),
    )
  })

  it('logout revokes session and clears cookies', async () => {
    const { controller, loginSessionService } = createController()
    const request = { cookies: { shionlib_refresh_token: 'rt' } }
    const response = { setHeader: jest.fn() }

    await controller.logout(request as any, response as any)

    expect(loginSessionService.logout).toHaveBeenCalledWith('rt')
    expect(response.setHeader).toHaveBeenCalledWith('Set-Cookie', [
      expect.stringContaining('shionlib_access_token=;'),
      expect.stringContaining('shionlib_refresh_token=;'),
    ])
  })

  it('delegates forget/check/reset password flows', async () => {
    const { controller, passwordService } = createController()
    const forgetDto = { email: 'a@b.c' }
    const checkDto = { email: 'a@b.c', code: '123456' }
    const resetDto = { email: 'a@b.c', code: '123456', password: 'new-password' }

    await controller.forgetPassword(forgetDto as any)
    await controller.checkForgetPassword(checkDto as any)
    await controller.resetPassword(resetDto as any)

    expect(passwordService.getEmail).toHaveBeenCalledWith(forgetDto)
    expect(passwordService.check).toHaveBeenCalledWith(checkDto)
    expect(passwordService.resetPassword).toHaveBeenCalledWith(resetDto)
  })
})
