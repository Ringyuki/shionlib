import { HttpStatus } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { of, throwError } from 'rxjs'
import { HttpService } from '@nestjs/axios'
import { OidcService } from './oidc.service'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { PrismaService } from '../../../prisma.service'
import { LoginSessionService } from './login-session.service'
import { UserStatus } from '../../../shared/enums/auth/user-status.enum'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'

const idToken = (claims: Record<string, unknown>) =>
  `eyJhbGciOiJSUzI1NiJ9.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.sig`

const p2002 = Object.assign(Object.create(Prisma.PrismaClientKnownRequestError.prototype), {
  code: 'P2002',
  message: 'unique constraint',
  name: 'PrismaClientKnownRequestError',
})

describe('OidcService', () => {
  const createService = () => {
    const http = { post: jest.fn(), get: jest.fn() } as unknown as HttpService
    const config = {
      get: jest.fn(
        (key: string) =>
          ({
            'oidc.issuer': 'http://idp.test/oidc',
            'oidc.clientId': 'shionlib',
            'oidc.clientSecret': 'secret',
            'oidc.redirectUri': 'http://localhost:3000/api/auth/oidc/callback',
            'oidc.scopes': 'openid profile email',
          })[key],
      ),
    } as unknown as ShionConfigService
    const prisma = {
      oidcIdentity: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        delete: jest.fn(),
      },
      user: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      userPasskeyCredential: { count: jest.fn() },
    } as unknown as PrismaService
    const loginSessionService = { issueOnLogin: jest.fn() } as unknown as LoginSessionService
    const service = new OidcService(http, config, prisma, loginSessionService)
    return { service, http, config, prisma, loginSessionService }
  }

  const mockToken = (http: HttpService, claims: Record<string, unknown>) => {
    ;(http.post as jest.Mock).mockReturnValue(
      of({ data: { id_token: idToken(claims), access_token: 'at', token_type: 'Bearer' } }),
    )
  }

  const issued = { token: 'access', tokenExp: new Date('2026-06-01'), refreshToken: 'refresh' }

  beforeEach(() => jest.clearAllMocks())

  describe('buildAuthorizeUrl', () => {
    it('builds an S256 PKCE authorize url and a tx carrying mode', () => {
      const { service } = createService()
      const { url, tx } = service.buildAuthorizeUrl('/games', 'link')

      expect(url).toContain('http://idp.test/oidc/auth?')
      expect(url).toContain('client_id=shionlib')
      expect(url).toContain('response_type=code')
      expect(url).toContain('code_challenge_method=S256')
      expect(url).toContain('scope=openid+profile+email')

      const parsed = JSON.parse(tx)
      expect(parsed.r).toBe('/games')
      expect(parsed.m).toBe('link')
      expect(typeof parsed.v).toBe('string')
      expect(typeof parsed.s).toBe('string')
    })

    it('defaults mode to login', () => {
      const { service } = createService()
      expect(JSON.parse(service.buildAuthorizeUrl('/').tx).m).toBe('login')
    })
  })

  describe('login', () => {
    it('authenticates a client_secret_basic token exchange and issues a session for a linked user', async () => {
      const { service, http, prisma, loginSessionService } = createService()
      mockToken(http, { sub: 1, email_verified: true })
      ;(prisma.oidcIdentity.findUnique as jest.Mock).mockResolvedValue({
        user: { id: 1933, role: 1, content_limit: 2, status: UserStatus.ACTIVE },
      })
      ;(loginSessionService.issueOnLogin as jest.Mock).mockResolvedValue(issued)

      const result = await service.login('code', 'verifier', { ip: '1.1.1.1', user_agent: 'jest' })

      expect(http.post).toHaveBeenCalledWith(
        'http://idp.test/oidc/token',
        expect.stringContaining('grant_type=authorization_code'),
        expect.objectContaining({
          headers: expect.objectContaining({
            authorization: `Basic ${Buffer.from('shionlib:secret').toString('base64')}`,
          }),
        }),
      )
      expect(prisma.oidcIdentity.update).toHaveBeenCalled()
      expect(loginSessionService.issueOnLogin).toHaveBeenCalledWith(
        1933,
        { ip: '1.1.1.1', user_agent: 'jest' },
        1,
        2,
      )
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1933 },
        data: { last_login_at: expect.any(Date) },
      })
      expect(result).toEqual({
        token: 'access',
        refresh_token: 'refresh',
        tokenExp: issued.tokenExp,
      })
    })

    it('blocks a banned user and issues no session', async () => {
      const { service, http, prisma, loginSessionService } = createService()
      mockToken(http, { sub: 1, email_verified: true })
      ;(prisma.oidcIdentity.findUnique as jest.Mock).mockResolvedValue({
        user: { id: 2, role: 1, content_limit: 2, status: UserStatus.BANNED },
      })

      await expect(service.login('code', 'verifier', {})).rejects.toMatchObject({
        reason: 'banned',
      })
      expect(loginSessionService.issueOnLogin).not.toHaveBeenCalled()
    })

    it('maps a failed token exchange to OidcFlowError(exchange)', async () => {
      const { service, http } = createService()
      ;(http.post as jest.Mock).mockReturnValue(throwError(() => new Error('network')))

      await expect(service.login('code', 'verifier', {})).rejects.toMatchObject({
        reason: 'exchange',
      })
    })

    it('treats a missing id_token as OidcFlowError(exchange)', async () => {
      const { service, http } = createService()
      ;(http.post as jest.Mock).mockReturnValue(of({ data: { access_token: 'at' } }))

      await expect(service.login('code', 'verifier', {})).rejects.toMatchObject({
        reason: 'exchange',
      })
    })

    it('treats an id_token without sub as OidcFlowError(exchange)', async () => {
      const { service, http } = createService()
      mockToken(http, { email: 'a@b.com' })

      await expect(service.login('code', 'verifier', {})).rejects.toMatchObject({
        reason: 'exchange',
      })
    })

    it('treats an undecodable id_token payload as OidcFlowError(exchange)', async () => {
      const { service, http } = createService()
      ;(http.post as jest.Mock).mockReturnValue(of({ data: { id_token: 'h.aGVsbG8.s' } }))

      await expect(service.login('code', 'verifier', {})).rejects.toMatchObject({
        reason: 'exchange',
      })
    })

    it('propagates a non-P2002 database error during provisioning', async () => {
      const { service, http, prisma } = createService()
      mockToken(http, { sub: 30, email: 'x@y.com', email_verified: true })
      ;(prisma.oidcIdentity.findUnique as jest.Mock).mockResolvedValue(null)
      ;(prisma.user.findFirst as jest.Mock).mockResolvedValue(null)
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)
      ;(prisma.user.create as jest.Mock).mockRejectedValue(new Error('db down'))

      await expect(service.login('code', 'verifier', {})).rejects.toThrow('db down')
    })

    it('rejects when the email is not verified', async () => {
      const { service, http, prisma } = createService()
      mockToken(http, { sub: 5, email: 'a@b.com', email_verified: false })
      ;(prisma.oidcIdentity.findUnique as jest.Mock).mockResolvedValue(null)

      await expect(service.login('code', 'verifier', {})).rejects.toMatchObject({
        reason: 'email_unverified',
      })
    })

    it('rejects when verified but no email claim is present', async () => {
      const { service, http, prisma } = createService()
      mockToken(http, { sub: 5, email_verified: true })
      ;(prisma.oidcIdentity.findUnique as jest.Mock).mockResolvedValue(null)

      await expect(service.login('code', 'verifier', {})).rejects.toMatchObject({
        reason: 'email_unverified',
      })
    })

    it('merges into an existing user matched by verified email', async () => {
      const { service, http, prisma, loginSessionService } = createService()
      mockToken(http, { sub: 9, email: 'Merge@Example.com', email_verified: true })
      ;(prisma.oidcIdentity.findUnique as jest.Mock).mockResolvedValue(null)
      ;(prisma.user.findFirst as jest.Mock).mockResolvedValue({
        id: 50,
        role: 1,
        content_limit: 2,
        status: UserStatus.ACTIVE,
      })
      ;(loginSessionService.issueOnLogin as jest.Mock).mockResolvedValue(issued)

      await service.login('code', 'verifier', {})

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: { equals: 'Merge@Example.com', mode: 'insensitive' } },
        orderBy: { id: 'asc' },
        select: expect.any(Object),
      })
      expect(prisma.oidcIdentity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ user_id: 50, provider: 'hikarinagi', subject: '9' }),
      })
      expect(loginSessionService.issueOnLogin).toHaveBeenCalledWith(50, {}, 1, 2)
    })

    it('auto-provisions a new user from claims when no account matches', async () => {
      const { service, http, prisma, loginSessionService } = createService()
      mockToken(http, {
        sub: 11,
        email: 'new@example.com',
        email_verified: true,
        preferred_username: 'ringyuki',
      })
      ;(prisma.oidcIdentity.findUnique as jest.Mock).mockResolvedValue(null)
      ;(prisma.user.findFirst as jest.Mock).mockResolvedValue(null)
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)
      ;(prisma.user.create as jest.Mock).mockResolvedValue({
        id: 99,
        role: 1,
        content_limit: 1,
        status: UserStatus.ACTIVE,
      })
      ;(loginSessionService.issueOnLogin as jest.Mock).mockResolvedValue(issued)

      await service.login('code', 'verifier', {})

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'ringyuki',
          email: 'new@example.com',
          email_verified_at: expect.any(Date),
          oidc_identities: { create: expect.objectContaining({ subject: '11' }) },
        }),
        select: expect.any(Object),
      })
      expect(loginSessionService.issueOnLogin).toHaveBeenCalledWith(99, {}, 1, 1)
    })

    it('disambiguates a taken username when provisioning', async () => {
      const { service, http, prisma, loginSessionService } = createService()
      mockToken(http, {
        sub: 12,
        email: 'dup@example.com',
        email_verified: true,
        preferred_username: 'ringyuki',
      })
      ;(prisma.oidcIdentity.findUnique as jest.Mock).mockResolvedValue(null)
      ;(prisma.user.findFirst as jest.Mock).mockResolvedValue(null)
      ;(prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValue(null)
      ;(prisma.user.create as jest.Mock).mockResolvedValue({
        id: 100,
        role: 1,
        content_limit: 1,
        status: UserStatus.ACTIVE,
      })
      ;(loginSessionService.issueOnLogin as jest.Mock).mockResolvedValue(issued)

      await service.login('code', 'verifier', {})

      const createdName = (prisma.user.create as jest.Mock).mock.calls[0][0].data.name as string
      expect(createdName).not.toBe('ringyuki')
      expect(createdName.startsWith('ringyuki')).toBe(true)
    })

    it('recovers from a P2002 race by re-resolving the now-existing link', async () => {
      const { service, http, prisma, loginSessionService } = createService()
      mockToken(http, { sub: 13, email: 'race@example.com', email_verified: true })
      ;(prisma.oidcIdentity.findUnique as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          user: { id: 77, role: 1, content_limit: 2, status: UserStatus.ACTIVE },
        })
      ;(prisma.user.findFirst as jest.Mock).mockResolvedValue(null)
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)
      ;(prisma.user.create as jest.Mock).mockRejectedValue(p2002)
      ;(loginSessionService.issueOnLogin as jest.Mock).mockResolvedValue(issued)

      await service.login('code', 'verifier', {})

      expect(loginSessionService.issueOnLogin).toHaveBeenCalledWith(77, {}, 1, 2)
    })
  })

  describe('linkToUser', () => {
    it('creates a link for an unclaimed subject', async () => {
      const { service, http, prisma } = createService()
      mockToken(http, { sub: 20, email: 'link@example.com' })
      ;(prisma.oidcIdentity.findUnique as jest.Mock).mockResolvedValue(null)

      await service.linkToUser(7, 'code', 'verifier')

      expect(prisma.oidcIdentity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          user_id: 7,
          subject: '20',
          email_at_link: 'link@example.com',
        }),
      })
    })

    it('is idempotent when the subject is already linked to the same user', async () => {
      const { service, http, prisma } = createService()
      mockToken(http, { sub: 20 })
      ;(prisma.oidcIdentity.findUnique as jest.Mock).mockResolvedValue({ user_id: 7 })

      await service.linkToUser(7, 'code', 'verifier')

      expect(prisma.oidcIdentity.create).not.toHaveBeenCalled()
    })

    it('rejects linking a subject already bound to another user', async () => {
      const { service, http, prisma } = createService()
      mockToken(http, { sub: 20 })
      ;(prisma.oidcIdentity.findUnique as jest.Mock).mockResolvedValue({ user_id: 999 })

      await expect(service.linkToUser(7, 'code', 'verifier')).rejects.toMatchObject({
        reason: 'link_conflict',
      })
      expect(prisma.oidcIdentity.create).not.toHaveBeenCalled()
    })
  })

  describe('listIdentities', () => {
    const setup = (over: { password?: string | null; passkeys?: number; items?: number }) => {
      const { service, prisma } = createService()
      ;(prisma.oidcIdentity.findMany as jest.Mock).mockResolvedValue(
        Array.from({ length: over.items ?? 1 }, (_, i) => ({
          id: i + 1,
          provider: 'hikarinagi',
          email_at_link: 'a@b.com',
          created: new Date(),
        })),
      )
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ password: over.password ?? null })
      ;(prisma.userPasskeyCredential.count as jest.Mock).mockResolvedValue(over.passkeys ?? 0)
      return service
    }

    it('allows unlink when a password is set', async () => {
      const service = setup({ password: 'hash', passkeys: 0, items: 1 })
      expect((await service.listIdentities(7)).can_unlink).toBe(true)
    })

    it('allows unlink when a passkey exists', async () => {
      const service = setup({ password: null, passkeys: 1, items: 1 })
      expect((await service.listIdentities(7)).can_unlink).toBe(true)
    })

    it('allows unlink when more than one link exists', async () => {
      const service = setup({ password: null, passkeys: 0, items: 2 })
      expect((await service.listIdentities(7)).can_unlink).toBe(true)
    })

    it('forbids unlink when the link is the only login method', async () => {
      const service = setup({ password: null, passkeys: 0, items: 1 })
      expect((await service.listIdentities(7)).can_unlink).toBe(false)
    })
  })

  describe('unlink', () => {
    it('throws NOT_FOUND when the identity is absent', async () => {
      const { service, prisma } = createService()
      ;(prisma.oidcIdentity.findUnique as jest.Mock).mockResolvedValue(null)

      await expect(service.unlink(7, 1)).rejects.toMatchObject({
        code: ShionBizCode.AUTH_OIDC_IDENTITY_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      })
    })

    it('throws NOT_FOUND when the identity belongs to another user', async () => {
      const { service, prisma } = createService()
      ;(prisma.oidcIdentity.findUnique as jest.Mock).mockResolvedValue({ id: 1, user_id: 999 })

      await expect(service.unlink(7, 1)).rejects.toMatchObject({
        code: ShionBizCode.AUTH_OIDC_IDENTITY_NOT_FOUND,
      })
    })

    it('refuses to unlink the only login method', async () => {
      const { service, prisma } = createService()
      ;(prisma.oidcIdentity.findUnique as jest.Mock).mockResolvedValue({ id: 1, user_id: 7 })
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ password: null })
      ;(prisma.userPasskeyCredential.count as jest.Mock).mockResolvedValue(0)
      ;(prisma.oidcIdentity.count as jest.Mock).mockResolvedValue(1)

      await expect(service.unlink(7, 1)).rejects.toMatchObject({
        code: ShionBizCode.AUTH_OIDC_LAST_LOGIN_METHOD,
        status: HttpStatus.BAD_REQUEST,
      })
      expect(prisma.oidcIdentity.delete).not.toHaveBeenCalled()
    })

    it('unlinks when another login method remains', async () => {
      const { service, prisma } = createService()
      ;(prisma.oidcIdentity.findUnique as jest.Mock).mockResolvedValue({ id: 1, user_id: 7 })
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ password: 'hash' })
      ;(prisma.userPasskeyCredential.count as jest.Mock).mockResolvedValue(0)
      ;(prisma.oidcIdentity.count as jest.Mock).mockResolvedValue(1)

      await service.unlink(7, 1)

      expect(prisma.oidcIdentity.delete).toHaveBeenCalledWith({ where: { id: 1 } })
    })
  })
})
