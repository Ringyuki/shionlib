import { Response } from 'express'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { AuthSessionResDto } from '../dto/res/auth-session.res.dto'

type AuthCookieTokens = {
  token: string
  refresh_token: string
}
type AuthSessionExpiry = {
  tokenExp: Date | null
  refreshTokenExp: Date | null
}

export const setAuthCookies = (
  response: Response,
  configService: ShionConfigService,
  { token, refresh_token }: AuthCookieTokens,
) => {
  response.setHeader('Set-Cookie', [
    `shionlib_access_token=${token}; HttpOnly; Secure ; SameSite=Lax; Path=/; Max-Age=${configService.get('token.expiresIn')}`,
    `shionlib_refresh_token=${refresh_token}; HttpOnly; Secure ; SameSite=Lax; Path=/; Max-Age=${configService.get('refresh_token.shortWindowSec')}`,
  ])
}

export const clearAuthCookies = (response: Response) => {
  response.setHeader('Set-Cookie', [
    'shionlib_access_token=; HttpOnly; Secure ; SameSite=Lax; Path=/; Max-Age=0',
    'shionlib_refresh_token=; HttpOnly; Secure ; SameSite=Lax; Path=/; Max-Age=0',
  ])
}

export const buildAuthSessionResponse = ({
  tokenExp,
  refreshTokenExp,
}: AuthSessionExpiry): AuthSessionResDto => ({
  accessTokenExpiresAt: tokenExp?.toISOString() ?? null,
  refreshTokenExpiresAt: refreshTokenExp?.toISOString() ?? null,
})
