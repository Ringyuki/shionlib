import { OidcController } from './oidc.controller'
import { OidcFlowError } from '../services/oidc.service'

const TX_COOKIE = 'shionlib_oidc_tx'
const CB = 'https://shionlib.com/api/auth/oidc/callback'

describe('OidcController', () => {
  const createController = () => {
    const oidcService = {
      buildAuthorizeUrl: jest.fn(() => ({
        url: 'http://idp.test/oidc/auth?x=1',
        tx: 'TX',
      })),
      resolveRedirectUri: jest.fn(() => CB),
      login: jest.fn(),
      linkToUser: jest.fn(),
      listIdentities: jest.fn(),
      unlink: jest.fn(),
    }
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'token.expiresIn') return 3600
        if (key === 'refresh_token.shortWindowSec') return 604800
        return undefined
      }),
    }
    const controller = new OidcController(oidcService as any, configService as any)
    return { controller, oidcService }
  }

  const res = () => ({ setHeader: jest.fn(), redirect: jest.fn() })
  const tx = (over: Partial<{ v: string; s: string; r: string; m: string; u: string }> = {}) =>
    JSON.stringify({ v: 'verifier', s: 'state', r: '/zh', m: 'login', u: CB, ...over })

  beforeEach(() => jest.clearAllMocks())

  describe('start', () => {
    it('sets the tx cookie and redirects to the authorize url', () => {
      const { controller, oidcService } = createController()
      const r = res()

      controller.start('/games', undefined as any, undefined as any, r as any)

      expect(oidcService.buildAuthorizeUrl).toHaveBeenCalledWith('/games', 'login', CB)
      expect(r.setHeader).toHaveBeenCalledWith(
        'Set-Cookie',
        expect.stringContaining(`${TX_COOKIE}=TX`),
      )
      expect(r.redirect).toHaveBeenCalledWith('http://idp.test/oidc/auth?x=1')
    })

    it('passes link mode through', () => {
      const { controller, oidcService } = createController()
      controller.start('/me', 'link', undefined as any, res() as any)
      expect(oidcService.buildAuthorizeUrl).toHaveBeenCalledWith('/me', 'link', CB)
    })

    it('sanitizes off-site returnTo to /', () => {
      const { controller, oidcService } = createController()
      controller.start('//evil.com', undefined as any, undefined as any, res() as any)
      controller.start('/\\evil.com', undefined as any, undefined as any, res() as any)
      controller.start('https://evil.com', undefined as any, undefined as any, res() as any)

      const calls = oidcService.buildAuthorizeUrl.mock.calls as unknown[][]
      for (const call of calls) expect(call[0]).toBe('/')
    })
  })

  describe('callback (login)', () => {
    it('exchanges, sets both session cookies, and redirects with oidc_login', async () => {
      const { controller, oidcService } = createController()
      oidcService.login.mockResolvedValue({ token: 'access', refresh_token: 'refresh' })
      const r = res()
      const req = { cookies: { [TX_COOKIE]: tx() }, user: { sub: 0 }, headers: {} }

      await controller.callback('code', 'state', undefined as any, req as any, r as any)

      expect(oidcService.login).toHaveBeenCalledWith('code', 'verifier', expect.any(Object), CB)
      const cookies = r.setHeader.mock.calls[0][1]
      expect(cookies).toEqual(
        expect.arrayContaining([
          expect.stringContaining('shionlib_oidc_tx=; '),
          expect.stringContaining('shionlib_access_token=access'),
          expect.stringContaining('shionlib_refresh_token=refresh'),
        ]),
      )
      expect(r.redirect).toHaveBeenCalledWith('/zh?oidc_login=1')
    })

    it('rejects a state mismatch without exchanging', async () => {
      const { controller, oidcService } = createController()
      const r = res()
      const req = { cookies: { [TX_COOKIE]: tx({ s: 'state' }) }, user: {}, headers: {} }

      await controller.callback('code', 'other-state', undefined as any, req as any, r as any)

      expect(oidcService.login).not.toHaveBeenCalled()
      expect(r.redirect).toHaveBeenCalledWith('/zh?oidc_error=state')
    })

    it('treats an IdP error response as a failure', async () => {
      const { controller, oidcService } = createController()
      const r = res()
      const req = { cookies: { [TX_COOKIE]: tx() }, user: {}, headers: {} }

      await controller.callback('', 'state', 'access_denied', req as any, r as any)

      expect(oidcService.login).not.toHaveBeenCalled()
      expect(r.redirect).toHaveBeenCalledWith('/zh?oidc_error=state')
    })

    it('keeps the post-login redirect on-origin even if the tx return path is hostile', async () => {
      const { controller, oidcService } = createController()
      oidcService.login.mockResolvedValue({ token: 'a', refresh_token: 'r' })
      const r = res()
      const req = { cookies: { [TX_COOKIE]: tx({ r: '//evil.com' }) }, user: {}, headers: {} }

      await controller.callback('code', 'state', undefined as any, req as any, r as any)

      expect(r.redirect).toHaveBeenCalledWith('/?oidc_login=1')
    })

    it('falls back to / and errors when the tx cookie is missing', async () => {
      const { controller, oidcService } = createController()
      const r = res()
      const req = { cookies: {}, user: {}, headers: {} }

      await controller.callback('code', 'state', undefined as any, req as any, r as any)

      expect(oidcService.login).not.toHaveBeenCalled()
      expect(r.redirect).toHaveBeenCalledWith('/?oidc_error=state')
    })

    it('rejects a structurally invalid tx cookie', async () => {
      const { controller, oidcService } = createController()
      const r = res()
      const req = {
        cookies: { [TX_COOKIE]: JSON.stringify({ foo: 'bar' }) },
        user: {},
        headers: {},
      }

      await controller.callback('code', 'state', undefined as any, req as any, r as any)

      expect(oidcService.login).not.toHaveBeenCalled()
      expect(r.redirect).toHaveBeenCalledWith('/?oidc_error=state')
    })
  })

  describe('callback (link)', () => {
    it('links the subject to the authenticated user and redirects with oidc_linked', async () => {
      const { controller, oidcService } = createController()
      const r = res()
      const req = { cookies: { [TX_COOKIE]: tx({ m: 'link' }) }, user: { sub: 7 }, headers: {} }

      await controller.callback('code', 'state', undefined as any, req as any, r as any)

      expect(oidcService.linkToUser).toHaveBeenCalledWith(7, 'code', 'verifier', CB)
      expect(oidcService.login).not.toHaveBeenCalled()
      expect(r.redirect).toHaveBeenCalledWith('/zh?oidc_linked=1')
    })

    it('requires authentication for link mode', async () => {
      const { controller, oidcService } = createController()
      const r = res()
      const req = { cookies: { [TX_COOKIE]: tx({ m: 'link' }) }, user: { sub: 0 }, headers: {} }

      await controller.callback('code', 'state', undefined as any, req as any, r as any)

      expect(oidcService.linkToUser).not.toHaveBeenCalled()
      expect(r.redirect).toHaveBeenCalledWith('/zh?oidc_error=link_auth')
    })

    it('surfaces a link conflict', async () => {
      const { controller, oidcService } = createController()
      oidcService.linkToUser.mockRejectedValue(new OidcFlowError('link_conflict'))
      const r = res()
      const req = { cookies: { [TX_COOKIE]: tx({ m: 'link' }) }, user: { sub: 7 }, headers: {} }

      await controller.callback('code', 'state', undefined as any, req as any, r as any)

      expect(r.redirect).toHaveBeenCalledWith('/zh?oidc_error=link_conflict')
    })
  })

  describe('identities crud', () => {
    it('lists the current user identities', () => {
      const { controller, oidcService } = createController()
      controller.listIdentities({ user: { sub: 42 } } as any)
      expect(oidcService.listIdentities).toHaveBeenCalledWith(42)
    })

    it('unlinks for the current user', async () => {
      const { controller, oidcService } = createController()
      await controller.unlink({ user: { sub: 42 } } as any, 9)
      expect(oidcService.unlink).toHaveBeenCalledWith(42, 9)
    })
  })
})
