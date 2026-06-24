import { createHash, randomBytes, randomInt } from 'node:crypto'
import { HttpStatus, Injectable } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { Prisma } from '@prisma/client'
import { firstValueFrom } from 'rxjs'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { PrismaService } from '../../../prisma.service'
import { UserStatus } from '../../../shared/enums/auth/user-status.enum'
import { UserContentLimit } from '../../user/interfaces/user.interface'
import { LoginSessionService } from './login-session.service'

export const OIDC_PROVIDER = 'hikarinagi'

export type OidcMode = 'login' | 'link'

export type OidcFailureReason =
  | 'state'
  | 'exchange'
  | 'email_unverified'
  | 'banned'
  | 'link_conflict'
  | 'link_auth'

export class OidcFlowError extends Error {
  constructor(public readonly reason: OidcFailureReason) {
    super(reason)
  }
}

export interface OidcDevice {
  ip?: string
  user_agent?: string
}

interface OidcClaims {
  sub: string
  email?: string
  email_verified?: boolean
  preferred_username?: string
  nickname?: string
  name?: string
}

const USER_SELECT = {
  id: true,
  role: true,
  content_limit: true,
  status: true,
} as const

function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  const segment = jwt.split('.')[1]
  if (!segment) return null
  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

@Injectable()
export class OidcService {
  constructor(
    private readonly http: HttpService,
    private readonly config: ShionConfigService,
    private readonly prisma: PrismaService,
    private readonly loginSessionService: LoginSessionService,
  ) {}

  buildAuthorizeUrl(returnTo: string, mode: OidcMode = 'login'): { url: string; tx: string } {
    const verifier = randomBytes(32).toString('base64url')
    const challenge = createHash('sha256').update(verifier).digest('base64url')
    const state = randomBytes(16).toString('base64url')

    const params = new URLSearchParams({
      client_id: this.config.get('oidc.clientId'),
      redirect_uri: this.config.get('oidc.redirectUri'),
      response_type: 'code',
      scope: this.config.get('oidc.scopes'),
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
    })

    return {
      url: `${this.config.get('oidc.issuer')}/auth?${params.toString()}`,
      tx: JSON.stringify({ v: verifier, s: state, r: returnTo, m: mode }),
    }
  }

  async linkToUser(userId: number, code: string, codeVerifier: string): Promise<void> {
    const claims = await this.fetchIdentity(code, codeVerifier)
    const key = { provider_subject: { provider: OIDC_PROVIDER, subject: claims.sub } }
    const existing = await this.prisma.oidcIdentity.findUnique({
      where: key,
      select: { user_id: true },
    })
    if (existing) {
      if (existing.user_id === userId) return
      throw new OidcFlowError('link_conflict')
    }
    await this.prisma.oidcIdentity.create({
      data: {
        user_id: userId,
        provider: OIDC_PROVIDER,
        subject: claims.sub,
        email_at_link: claims.email,
        last_login_at: new Date(),
      },
    })
  }

  async listIdentities(userId: number) {
    const [items, user, passkeyCount] = await Promise.all([
      this.prisma.oidcIdentity.findMany({
        where: { user_id: userId },
        select: { id: true, provider: true, email_at_link: true, created: true },
        orderBy: { created: 'asc' },
      }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { password: true } }),
      this.prisma.userPasskeyCredential.count({ where: { user_id: userId, revoked_at: null } }),
    ])
    return { items, can_unlink: !!user?.password || passkeyCount > 0 || items.length > 1 }
  }

  async unlink(userId: number, identityId: number): Promise<void> {
    const identity = await this.prisma.oidcIdentity.findUnique({
      where: { id: identityId },
      select: { id: true, user_id: true },
    })
    if (!identity || identity.user_id !== userId) {
      throw new ShionBizException(
        ShionBizCode.AUTH_OIDC_IDENTITY_NOT_FOUND,
        'shion-biz.AUTH_OIDC_IDENTITY_NOT_FOUND',
        undefined,
        HttpStatus.NOT_FOUND,
      )
    }
    const [user, passkeyCount, linkCount] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { password: true } }),
      this.prisma.userPasskeyCredential.count({ where: { user_id: userId, revoked_at: null } }),
      this.prisma.oidcIdentity.count({ where: { user_id: userId } }),
    ])
    if (!user?.password && passkeyCount === 0 && linkCount <= 1) {
      throw new ShionBizException(
        ShionBizCode.AUTH_OIDC_LAST_LOGIN_METHOD,
        'shion-biz.AUTH_OIDC_LAST_LOGIN_METHOD',
        undefined,
        HttpStatus.BAD_REQUEST,
      )
    }
    await this.prisma.oidcIdentity.delete({ where: { id: identityId } })
  }

  async login(code: string, codeVerifier: string, device: OidcDevice) {
    const claims = await this.fetchIdentity(code, codeVerifier)
    const user = await this.resolveUser(claims)
    if (user.status === UserStatus.BANNED) throw new OidcFlowError('banned')

    const { token, tokenExp, refreshToken } = await this.loginSessionService.issueOnLogin(
      user.id,
      device,
      user.role,
      user.content_limit,
    )
    await this.prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    })
    return { token, refresh_token: refreshToken, tokenExp }
  }

  private async fetchIdentity(code: string, codeVerifier: string): Promise<OidcClaims> {
    const issuer = this.config.get('oidc.issuer')
    const basic = Buffer.from(
      `${encodeURIComponent(this.config.get('oidc.clientId'))}:${encodeURIComponent(
        this.config.get('oidc.clientSecret'),
      )}`,
    ).toString('base64')

    let idToken: string
    try {
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.get('oidc.redirectUri'),
        code_verifier: codeVerifier,
      })
      const { data } = await firstValueFrom(
        this.http.post(`${issuer}/token`, body.toString(), {
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            authorization: `Basic ${basic}`,
          },
        }),
      )
      idToken = data?.id_token
      if (!idToken) throw new Error('missing id_token')
    } catch {
      throw new OidcFlowError('exchange')
    }

    const claims = decodeJwtPayload(idToken)
    if (!claims || typeof claims.sub === 'undefined') throw new OidcFlowError('exchange')
    return {
      sub: String(claims.sub),
      email: claims.email as string | undefined,
      email_verified: claims.email_verified as boolean | undefined,
      preferred_username: claims.preferred_username as string | undefined,
      nickname: claims.nickname as string | undefined,
      name: claims.name as string | undefined,
    }
  }

  private async resolveUser(claims: OidcClaims) {
    const linked = await this.findLinkedUser(claims.sub)
    if (linked) return linked

    if (!claims.email || claims.email_verified !== true) throw new OidcFlowError('email_unverified')

    try {
      return await this.linkOrProvision(claims)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const raced = await this.findLinkedUser(claims.sub)
        if (raced) return raced
      }
      throw error
    }
  }

  private async findLinkedUser(sub: string) {
    const key = { provider_subject: { provider: OIDC_PROVIDER, subject: sub } }
    const link = await this.prisma.oidcIdentity.findUnique({
      where: key,
      select: { user: { select: USER_SELECT } },
    })
    if (!link) return null
    await this.prisma.oidcIdentity.update({ where: key, data: { last_login_at: new Date() } })
    return link.user
  }

  private async linkOrProvision(claims: OidcClaims) {
    const existing = await this.prisma.user.findFirst({
      where: { email: { equals: claims.email!, mode: 'insensitive' } },
      orderBy: { id: 'asc' },
      select: USER_SELECT,
    })
    if (existing) {
      await this.prisma.oidcIdentity.create({
        data: {
          user_id: existing.id,
          provider: OIDC_PROVIDER,
          subject: claims.sub,
          email_at_link: claims.email,
          last_login_at: new Date(),
        },
      })
      return existing
    }

    return this.prisma.user.create({
      data: {
        name: await this.allocateName(claims),
        email: claims.email!,
        email_verified_at: new Date(),
        content_limit: UserContentLimit.NEVER_SHOW_NSFW_CONTENT,
        upload_quota: { create: { size: 0n, used: 0n } },
        favorites: { create: { name: 'default', default: true } },
        oidc_identities: {
          create: {
            provider: OIDC_PROVIDER,
            subject: claims.sub,
            email_at_link: claims.email,
            last_login_at: new Date(),
          },
        },
      },
      select: USER_SELECT,
    })
  }

  private async allocateName(claims: OidcClaims): Promise<string> {
    const raw = (claims.preferred_username || claims.nickname || claims.name || 'user').trim()
    const base = (raw.length >= 2 ? raw : `user_${raw}`).slice(0, 16)

    for (let attempt = 0; attempt < 50; attempt++) {
      const candidate =
        attempt === 0 ? base : `${base.slice(0, 15)}${randomInt(1000, 10000)}`.slice(0, 20)
      const taken = await this.prisma.user.findUnique({
        where: { name: candidate },
        select: { id: true },
      })
      if (!taken) return candidate
    }
    return `user_${randomInt(10000000, 100000000)}`
  }
}
