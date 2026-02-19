import { PermissionController } from './permission.controller'

describe('PermissionController', () => {
  it('delegates permission detail query using request user and dto entity', async () => {
    const permissionService = {
      getPermissionDetails: jest.fn(),
    }
    const controller = new PermissionController(permissionService as any)
    const req = { user: { sub: 12, role: 2 } }
    const dto = { entity: 'game' }

    await controller.getPermissions(req as any, dto as any)

    expect(permissionService.getPermissionDetails).toHaveBeenCalledWith(12, 2, 'game')
  })
})
