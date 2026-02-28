import { UserInfoController } from './user-info.controller'

describe('UserInfoController', () => {
  const createController = () => {
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

    return {
      userInfoService,
      controller: new UserInfoController(userInfoService as any),
    }
  }

  it('delegates updateAvatar', async () => {
    const { controller, userInfoService } = createController()
    const file = { mimetype: 'image/png' }
    const request = { user: { sub: 'u1' } }

    await controller.updateAvatar(file as any, request as any)

    expect(userInfoService.updateAvatar).toHaveBeenCalledWith(file, 'u1')
  })

  it('delegates updateCover', async () => {
    const { controller, userInfoService } = createController()
    const file = { mimetype: 'image/png', buffer: Buffer.from(''), size: 100 }

    await controller.updateCover(file as any, { user: { sub: 'u2' } } as any)

    expect(userInfoService.updateCover).toHaveBeenCalledWith(file, 'u2')
  })

  it('delegates updateName', async () => {
    const { controller, userInfoService } = createController()

    await controller.updateName({ name: 'alice' } as any, { user: { sub: 'u3' } } as any)

    expect(userInfoService.updateName).toHaveBeenCalledWith('alice', 'u3')
  })

  it('delegates requestCode', async () => {
    const { controller, userInfoService } = createController()

    await controller.requestCode({ user: { sub: 'u4' } } as any)

    expect(userInfoService.requestCode).toHaveBeenCalledWith('u4')
  })

  it('delegates updateEmail', async () => {
    const { controller, userInfoService } = createController()
    const dto = { email: 'test@example.com', code: '123456' }

    await controller.updateEmail(dto as any, { user: { sub: 'u5' } } as any)

    expect(userInfoService.updateEmail).toHaveBeenCalledWith(dto, 'u5')
  })

  it('delegates updatePassword', async () => {
    const { controller, userInfoService } = createController()

    await controller.updatePassword(
      { password: 'new-pass', old_password: 'old-pass' } as any,
      { user: { sub: 'u6' } } as any,
    )

    expect(userInfoService.updatePassword).toHaveBeenCalledWith('new-pass', 'old-pass', 'u6')
  })

  it('delegates updateLang', async () => {
    const { controller, userInfoService } = createController()

    await controller.updateLang({ lang: 'ja' }, { user: { sub: 'u7' } } as any)

    expect(userInfoService.updateLang).toHaveBeenCalledWith('ja', 'u7')
  })

  it('delegates updateContentLimit', async () => {
    const { controller, userInfoService } = createController()

    await controller.updateContentLimit({ content_limit: 2 }, { user: { sub: 'u8' } } as any)

    expect(userInfoService.updateContentLimit).toHaveBeenCalledWith(2, 'u8')
  })
})
