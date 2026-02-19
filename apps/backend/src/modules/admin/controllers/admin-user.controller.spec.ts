import { AdminUserController } from './admin-user.controller'

describe('AdminUserController', () => {
  const createController = () => {
    const adminUserService = {
      getUserList: jest.fn(),
      getUserDetail: jest.fn(),
      updateUserProfile: jest.fn(),
      updateUserRole: jest.fn(),
      banUser: jest.fn(),
      unbanUser: jest.fn(),
      resetPassword: jest.fn(),
      forceLogout: jest.fn(),
      getUserSessions: jest.fn(),
      getUserEditPermissions: jest.fn(),
      updateUserEditPermissions: jest.fn(),
      adjustUserUploadQuotaSize: jest.fn(),
      adjustUserUploadQuotaUsed: jest.fn(),
      resetUserUploadQuotaUsed: jest.fn(),
    }

    return {
      adminUserService,
      controller: new AdminUserController(adminUserService as any),
    }
  }

  it('delegates user read and profile operations', async () => {
    const { controller, adminUserService } = createController()
    const req = { user: { sub: 'admin' } }

    await controller.getUsers({ page: 1 } as any)
    await controller.getUserDetail(1)
    await controller.updateUserProfile(2, { name: 'x' } as any, req as any)
    await controller.updateUserRole(3, { role: 2 } as any, req as any)

    expect(adminUserService.getUserList).toHaveBeenCalled()
    expect(adminUserService.getUserDetail).toHaveBeenCalledWith(1)
    expect(adminUserService.updateUserProfile).toHaveBeenCalledWith(2, { name: 'x' }, req.user)
    expect(adminUserService.updateUserRole).toHaveBeenCalledWith(3, { role: 2 }, req.user)
  })

  it('delegates account actions', async () => {
    const { controller, adminUserService } = createController()
    const req = { user: { sub: 'admin2' } }

    await controller.banUser(4, { reason: 'spam' } as any, req as any)
    await controller.unbanUser(5, req as any)
    await controller.resetPassword(6, { password: 'new-pass' } as any, req as any)
    await controller.forceLogout(7, req as any)

    expect(adminUserService.banUser).toHaveBeenCalledWith(4, { reason: 'spam' }, req.user)
    expect(adminUserService.unbanUser).toHaveBeenCalledWith(5, req.user)
    expect(adminUserService.resetPassword).toHaveBeenCalledWith(
      6,
      { password: 'new-pass' },
      req.user,
    )
    expect(adminUserService.forceLogout).toHaveBeenCalledWith(7, req.user)
  })

  it('delegates sessions, permissions and quota operations', async () => {
    const { controller, adminUserService } = createController()
    const req = { user: { sub: 'admin3' } }

    await controller.getSessions(8, { page: 1 } as any)
    await controller.getUserPermissions(9, { entity: 'GAME' } as any, req as any)
    await controller.updateUserPermissions(
      10,
      { entity: 'GAME', allowBits: [1, 2] } as any,
      req as any,
    )
    await controller.adjustQuotaSize(11, { deltaMb: 256 } as any, req as any)
    await controller.adjustQuotaUsed(12, { deltaMb: -128 } as any, req as any)
    await controller.resetQuotaUsed(13, req as any)

    expect(adminUserService.getUserSessions).toHaveBeenCalledWith(8, { page: 1 })
    expect(adminUserService.getUserEditPermissions).toHaveBeenCalledWith(9, 'GAME', req.user)
    expect(adminUserService.updateUserEditPermissions).toHaveBeenCalledWith(
      10,
      'GAME',
      [1, 2],
      req.user,
    )
    expect(adminUserService.adjustUserUploadQuotaSize).toHaveBeenCalledWith(
      11,
      { deltaMb: 256 },
      req.user,
    )
    expect(adminUserService.adjustUserUploadQuotaUsed).toHaveBeenCalledWith(
      12,
      { deltaMb: -128 },
      req.user,
    )
    expect(adminUserService.resetUserUploadQuotaUsed).toHaveBeenCalledWith(13, req.user)
  })
})
