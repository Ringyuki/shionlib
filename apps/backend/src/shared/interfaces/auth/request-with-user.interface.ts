import { Request } from 'express'
import { TokenPayloadInterface } from '../../../modules/auth/interfaces/token-payload.interface'

export interface RequestAuthState {
  optionalTokenStale?: boolean
  optionalTokenReason?: string
}

export interface RequestWithUser extends Request {
  user: TokenPayloadInterface
  auth?: RequestAuthState
}
