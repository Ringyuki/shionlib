import { ExecutionContext } from '@nestjs/common'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard'

describe('OptionalJwtAuthGuard', () => {
  const getContext = (req: Record<string, any>): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    }) as unknown as ExecutionContext

  it('falls back to guest user when token is not provided', () => {
    const guard = new OptionalJwtAuthGuard()
    const req: Record<string, any> = { headers: {}, cookies: {} }

    const user = guard.handleRequest(undefined, null, undefined, getContext(req))

    expect(user).toMatchObject({
      sub: 0,
      role: ShionlibUserRoles.USER,
      content_limit: 0,
      type: 'access',
    })
    expect(req.auth).toEqual({ optionalTokenStale: false })
  })

  it('marks token as stale when token is provided but validation fails', () => {
    const guard = new OptionalJwtAuthGuard()
    const req: Record<string, any> = {
      headers: { authorization: 'Bearer invalid-token' },
      cookies: {},
    }

    guard.handleRequest(undefined, null, new Error('TokenExpiredError'), getContext(req))

    expect(req.auth).toEqual({
      optionalTokenStale: true,
      optionalTokenReason: 'Error',
    })
  })

  it('uses authenticated user when validation succeeds', () => {
    const guard = new OptionalJwtAuthGuard()
    const req: Record<string, any> = {
      headers: { authorization: 'Bearer valid' },
      cookies: {},
    }
    const existingUser = {
      sub: 123,
      role: ShionlibUserRoles.ADMIN,
      content_limit: 2,
      type: 'access' as const,
    }

    const result = guard.handleRequest(undefined, existingUser, undefined, getContext(req))

    expect(result).toEqual(existingUser)
    expect(req.auth).toEqual({ optionalTokenStale: false })
  })
})
