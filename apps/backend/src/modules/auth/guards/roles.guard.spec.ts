import { ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'
import { RolesGuard } from './roles.guard'

describe('RolesGuard', () => {
  const getContext = (role: ShionlibUserRoles): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          user: { role },
        }),
      }),
      getHandler: () => undefined,
      getClass: () => undefined,
    }) as unknown as ExecutionContext

  it('allows request when no roles are required', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector
    const guard = new RolesGuard(reflector)

    expect(guard.canActivate(getContext(ShionlibUserRoles.USER))).toBe(true)
  })

  it('checks hierarchical roles for non-super-admin requirements', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([ShionlibUserRoles.ADMIN]),
    } as unknown as Reflector
    const guard = new RolesGuard(reflector)

    expect(guard.canActivate(getContext(ShionlibUserRoles.USER))).toBe(false)
    expect(guard.canActivate(getContext(ShionlibUserRoles.ADMIN))).toBe(true)
    expect(guard.canActivate(getContext(ShionlibUserRoles.SUPER_ADMIN))).toBe(true)
  })

  it('requires exact super-admin when SUPER_ADMIN role is present', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([ShionlibUserRoles.SUPER_ADMIN]),
    } as unknown as Reflector
    const guard = new RolesGuard(reflector)

    expect(guard.canActivate(getContext(ShionlibUserRoles.ADMIN))).toBe(false)
    expect(guard.canActivate(getContext(ShionlibUserRoles.SUPER_ADMIN))).toBe(true)
  })
})
