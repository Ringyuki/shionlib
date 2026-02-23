import { PasskeyController } from './passkey.controller'

describe('PasskeyController', () => {
  const createController = () => {
    const passkeyService = {
      createRegisterOptions: jest.fn(),
      verifyRegister: jest.fn(),
      createLoginOptions: jest.fn(),
      verifyLogin: jest.fn(),
      listMyPasskeys: jest.fn(),
      revokeMyPasskey: jest.fn(),
    }
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'token.expiresIn') return 3600
        if (key === 'refresh_token.shortWindowSec') return 604800
        return undefined
      }),
    }

    return {
      passkeyService,
      configService,
      controller: new PasskeyController(passkeyService as any, configService as any),
    }
  }

  it('delegates register options and verify to service', async () => {
    const { controller, passkeyService } = createController()
    const req = { user: { sub: 7 } }
    const optionsDto = { name: 'My MacBook' }
    const verifyDto = {
      flow_id: 'flow-1',
      response: { id: 'cred-1' },
      name: 'My MacBook',
    }

    await controller.createRegisterOptions(req as any, optionsDto as any)
    await controller.verifyRegister(req as any, verifyDto as any)

    expect(passkeyService.createRegisterOptions).toHaveBeenCalledWith(req, 'My MacBook')
    expect(passkeyService.verifyRegister).toHaveBeenCalledWith(
      req,
      'flow-1',
      verifyDto.response,
      'My MacBook',
    )
  })

  it('delegates login options to service', async () => {
    const { controller, passkeyService } = createController()
    const dto = { identifier: 'alice@example.com' }

    await controller.createLoginOptions(dto as any)

    expect(passkeyService.createLoginOptions).toHaveBeenCalledWith('alice@example.com')
  })

  it('verifies login and sets auth cookies', async () => {
    const { controller, passkeyService } = createController()
    passkeyService.verifyLogin.mockResolvedValue({
      token: 'access-token',
      refresh_token: 'refresh-token',
    })
    const req = { user: { sub: 1 } }
    const dto = { flow_id: 'flow-2', response: { id: 'assertion-1' } }
    const response = { setHeader: jest.fn() }

    await controller.verifyLogin(req as any, dto as any, response as any)

    expect(passkeyService.verifyLogin).toHaveBeenCalledWith('flow-2', dto.response, req)
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

  it('lists current user passkeys', async () => {
    const { controller, passkeyService } = createController()
    const req = { user: { sub: 99 } }

    await controller.list(req as any)

    expect(passkeyService.listMyPasskeys).toHaveBeenCalledWith(99)
  })

  it('removes current user passkey', async () => {
    const { controller, passkeyService } = createController()
    const req = { user: { sub: 88 } }

    await controller.remove(req as any, 12)

    expect(passkeyService.revokeMyPasskey).toHaveBeenCalledWith(88, 12)
  })
})
