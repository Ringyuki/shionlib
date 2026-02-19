import { ExecutionContext } from '@nestjs/common'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { PermissionEntity } from '../enums/permission-entity.enum'
import { PermissionService } from '../services/permission.service'
import { EditAuthGuard } from './edit-auth.guard'

const createContext = (body: Record<string, any>, user = { sub: 1, role: 2 }): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ body, user }),
    }),
  }) as unknown as ExecutionContext

describe('EditAuthGuard', () => {
  let perms: { getAllowMaskFor: jest.Mock }

  beforeEach(() => {
    perms = {
      getAllowMaskFor: jest.fn().mockResolvedValue(0n),
    }
  })

  it('allows request when no permission bits are required', async () => {
    const GuardClass = EditAuthGuard(PermissionEntity.GAME, () => [])
    const guard = new GuardClass(perms as unknown as PermissionService)

    await expect(guard.canActivate(createContext({ title: 'x' }))).resolves.toBe(true)
    expect(perms.getAllowMaskFor).not.toHaveBeenCalled()
  })

  it('allows request when allow mask contains all requested bits', async () => {
    const GuardClass = EditAuthGuard(PermissionEntity.GAME, () => [1, 3])
    const guard = new GuardClass(perms as unknown as PermissionService)
    perms.getAllowMaskFor.mockResolvedValue((1n << 1n) | (1n << 3n))

    await expect(guard.canActivate(createContext({ title: 'x', summary: 'y' }))).resolves.toBe(true)
    expect(perms.getAllowMaskFor).toHaveBeenCalledWith(1, 2, PermissionEntity.GAME)
  })

  it('throws denied bits with denied field list from key mapping', async () => {
    const GuardClass = EditAuthGuard(PermissionEntity.GAME, () => [1, 2], {
      name: 1,
      desc: 2,
    })
    const guard = new GuardClass(perms as unknown as PermissionService)
    perms.getAllowMaskFor.mockResolvedValue(1n << 1n)

    await expect(guard.canActivate(createContext({ name: 'n', desc: 'd' }))).rejects.toMatchObject({
      code: ShionBizCode.EDIT_FIELD_PERMISSION_NOT_ENOUGH,
      args: {
        deniedBits: [2],
        deniedFields: ['desc'],
      },
    })
  })

  it('throws denied relation key when key mapping is not provided', async () => {
    const GuardClass = EditAuthGuard(PermissionEntity.GAME, () => [5], undefined, 'developers')
    const guard = new GuardClass(perms as unknown as PermissionService)
    perms.getAllowMaskFor.mockResolvedValue(0n)

    await expect(guard.canActivate(createContext({ developers: [1, 2] }))).rejects.toMatchObject({
      code: ShionBizCode.EDIT_FIELD_PERMISSION_NOT_ENOUGH,
      args: {
        deniedBits: [5],
        deniedFields: 'developers',
      },
    })
  })
})
