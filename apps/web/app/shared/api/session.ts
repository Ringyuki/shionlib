import { isFailure } from './failure.schema'
import { BusinessCode } from './generated/business-codes'

export const authStaleHeader = 'shionlib-auth-stale'

const refreshCodes: number[] = [BusinessCode.AUTH_UNAUTHORIZED, BusinessCode.AUTH_INVALID_TOKEN]

export function asksForRefresh(status: number, headers: Headers, body: unknown): boolean {
  if (headers.get(authStaleHeader) === '1') {
    return true
  }
  return status === 401 && isFailure(body) && refreshCodes.includes(body.code)
}
