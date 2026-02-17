import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'

export interface TokenPayloadInterface {
  sub: number // user id
  fid?: string // family id
  sid?: number // session id
  role: ShionlibUserRoles
  content_limit: number
  type: 'access'
}
