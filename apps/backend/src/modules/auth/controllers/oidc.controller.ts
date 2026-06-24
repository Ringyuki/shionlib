import { Controller, Get, Query, Req, Res } from '@nestjs/common'
import { Request, Response } from 'express'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { OidcFlowError, OidcService } from '../services/oidc.service'

interface OidcTx {
  v: string
  s: string
  r: string
}

const TX_COOKIE = 'shionlib_oidc_tx'
const COOKIE_FLAGS = 'HttpOnly; Secure ; SameSite=Lax; Path=/'

function safeReturnTo(raw: unknown): string {
  if (typeof raw !== 'string' || !raw) return '/'
  try {
    const url = new URL(raw, 'http://localhost')
    if (url.origin !== 'http://localhost') return '/'
    const path = `${url.pathname}${url.search}`
    return path.startsWith('/') ? path : '/'
  } catch {
    return '/'
  }
}

function parseTx(raw: unknown): OidcTx | null {
  if (typeof raw !== 'string') return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.v === 'string' && typeof parsed.s === 'string') {
      return { v: parsed.v, s: parsed.s, r: safeReturnTo(parsed.r) }
    }
  } catch {
    /* malformed tx cookie */
  }
  return null
}

function withQuery(path: string, key: string, value: string): string {
  return `${path}${path.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(value)}`
}

@Controller('auth/oidc')
export class OidcController {
  constructor(
    private readonly oidcService: OidcService,
    private readonly configService: ShionConfigService,
  ) {}

  @Get('start')
  start(@Query('returnTo') returnTo: string, @Res() res: Response) {
    const { url, tx } = this.oidcService.buildAuthorizeUrl(safeReturnTo(returnTo))
    res.setHeader(
      'Set-Cookie',
      `${TX_COOKIE}=${encodeURIComponent(tx)}; ${COOKIE_FLAGS}; Max-Age=600`,
    )
    res.redirect(url)
  }

  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') idpError: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const tx = parseTx(req.cookies?.[TX_COOKIE])
    const returnTo = tx?.r ?? '/'
    const clearTx = `${TX_COOKIE}=; ${COOKIE_FLAGS}; Max-Age=0`

    try {
      if (idpError) throw new OidcFlowError('state')
      if (!code || !state || !tx || tx.s !== state) throw new OidcFlowError('state')

      const device = {
        ip: (req.headers['x-real-ip'] as string) || (req.headers['cf-connecting-ip'] as string),
        user_agent: req.headers['user-agent'],
      }
      const { token, refresh_token } = await this.oidcService.login(code, tx.v, device)

      res.setHeader('Set-Cookie', [
        clearTx,
        `shionlib_access_token=${token}; ${COOKIE_FLAGS}; Max-Age=${this.configService.get('token.expiresIn')}`,
        `shionlib_refresh_token=${refresh_token}; ${COOKIE_FLAGS}; Max-Age=${this.configService.get('refresh_token.shortWindowSec')}`,
      ])
      res.redirect(withQuery(returnTo, 'oidc_login', '1'))
    } catch (error) {
      const reason = error instanceof OidcFlowError ? error.reason : 'provider'
      res.setHeader('Set-Cookie', clearTx)
      res.redirect(withQuery(returnTo, 'oidc_error', reason))
    }
  }
}
