import { SetMetadata } from '@nestjs/common'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'

export const ROLES_KEY = 'roles'
export const Roles = (...roles: ShionlibUserRoles[]) => SetMetadata(ROLES_KEY, roles)
