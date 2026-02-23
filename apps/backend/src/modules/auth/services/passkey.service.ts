import { HttpStatus, Injectable } from '@nestjs/common'
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { PrismaService } from '../../../prisma.service'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { CacheService } from '../../cache/services/cache.service'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { UserStatus } from '../../../shared/enums/auth/user-status.enum'
import { LoginSessionService } from './login-session.service'

type RegisterChallengeState = {
  kind: 'register'
  challenge: string
  userId: number
  suggestedName?: string
}

type LoginChallengeState = {
  kind: 'login'
  challenge: string
  userId?: number
}

type ChallengeState = RegisterChallengeState | LoginChallengeState

@Injectable()
export class PasskeyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ShionConfigService,
    private readonly cacheService: CacheService,
    private readonly loginSessionService: LoginSessionService,
  ) {}

  async createRegisterOptions(
    req: RequestWithUser,
    suggestedName?: string,
  ): Promise<{ flow_id: string; options: PublicKeyCredentialCreationOptionsJSON }> {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.sub },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
      },
    })
    if (!user) {
      throw new ShionBizException(ShionBizCode.USER_NOT_FOUND, 'shion-biz.USER_NOT_FOUND')
    }
    if (user.status === UserStatus.BANNED) {
      throw new ShionBizException(ShionBizCode.USER_BANNED, 'shion-biz.USER_BANNED')
    }

    const existing = await this.prisma.userPasskeyCredential.findMany({
      where: {
        user_id: user.id,
        revoked_at: null,
      },
      select: {
        credential_id: true,
        transports: true,
      },
      orderBy: { created: 'asc' },
    })

    const options = await generateRegistrationOptions({
      rpID: this.configService.get('webauthn.rpId'),
      rpName: this.configService.get('webauthn.rpName'),
      userID: Buffer.from(String(user.id), 'utf8'),
      userName: user.email,
      userDisplayName: user.name,
      timeout: this.configService.get('webauthn.timeoutMs'),
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'required',
      },
      excludeCredentials: existing.map(item => ({
        id: item.credential_id,
        transports: this.asTransports(item.transports),
      })),
    })

    const flowId = randomUUID()
    await this.saveChallenge(flowId, {
      kind: 'register',
      challenge: options.challenge,
      userId: user.id,
      suggestedName,
    })

    return { flow_id: flowId, options }
  }

  async verifyRegister(
    req: RequestWithUser,
    flowId: string,
    response: RegistrationResponseJSON,
    name?: string,
  ) {
    const state = await this.consumeChallenge(flowId, 'register')
    if (state.userId !== req.user.sub) {
      throw new ShionBizException(
        ShionBizCode.AUTH_UNAUTHORIZED,
        'shion-biz.AUTH_UNAUTHORIZED',
        undefined,
        HttpStatus.UNAUTHORIZED,
      )
    }

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: state.challenge,
      expectedOrigin: this.configService.get('webauthn.origins'),
      expectedRPID: this.configService.get('webauthn.rpId'),
      requireUserVerification: true,
    })

    if (!verification.verified || !verification.registrationInfo) {
      throw new ShionBizException(
        ShionBizCode.AUTH_UNAUTHORIZED,
        'shion-biz.AUTH_UNAUTHORIZED',
        undefined,
        HttpStatus.UNAUTHORIZED,
      )
    }

    const { registrationInfo } = verification
    const credentialId = registrationInfo.credential.id
    const publicKey = this.toBase64Url(Buffer.from(registrationInfo.credential.publicKey))
    const counter = registrationInfo.credential.counter
    const transports = this.asTransports(response.response.transports)
    const credentialName = (name || state.suggestedName || '').trim() || null

    try {
      const created = await this.prisma.userPasskeyCredential.create({
        data: {
          user_id: state.userId,
          credential_id: credentialId,
          public_key: publicKey,
          counter,
          transports,
          aaguid: registrationInfo.aaguid || null,
          device_type: registrationInfo.credentialDeviceType,
          credential_backed_up: registrationInfo.credentialBackedUp,
          name: credentialName,
          last_used_at: new Date(),
        },
        select: {
          id: true,
          credential_id: true,
          name: true,
          device_type: true,
          credential_backed_up: true,
          created: true,
        },
      })

      await this.prisma.user.update({
        where: { id: state.userId },
        data: { two_factor_enabled: true },
      })

      return created
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ShionBizException(
          ShionBizCode.AUTH_UNAUTHORIZED,
          'shion-biz.AUTH_UNAUTHORIZED',
          undefined,
          HttpStatus.CONFLICT,
        )
      }
      throw error
    }
  }

  async createLoginOptions(identifier?: string): Promise<{
    flow_id: string
    options: PublicKeyCredentialRequestOptionsJSON
  }> {
    let userId: number | undefined
    let allowCredentials: { id: string; transports?: AuthenticatorTransportFuture[] }[] | undefined

    const normalizedIdentifier = identifier?.trim()
    if (normalizedIdentifier) {
      const foundUser = await this.prisma.user.findFirst({
        where: {
          OR: [
            { email: { equals: normalizedIdentifier, mode: 'insensitive' } },
            { name: { equals: normalizedIdentifier, mode: 'insensitive' } },
          ],
        },
        select: { id: true, status: true },
      })
      if (!foundUser) {
        throw new ShionBizException(
          ShionBizCode.USER_NOT_FOUND,
          'shion-biz.USER_NOT_FOUND',
          undefined,
          HttpStatus.NOT_FOUND,
        )
      }
      if (foundUser.status === UserStatus.BANNED) {
        throw new ShionBizException(ShionBizCode.USER_BANNED, 'shion-biz.USER_BANNED')
      }
      userId = foundUser.id

      const creds = await this.prisma.userPasskeyCredential.findMany({
        where: { user_id: foundUser.id, revoked_at: null },
        select: { credential_id: true, transports: true },
      })
      allowCredentials = creds.map(item => ({
        id: item.credential_id,
        transports: this.asTransports(item.transports),
      }))
    }

    const options = await generateAuthenticationOptions({
      rpID: this.configService.get('webauthn.rpId'),
      timeout: this.configService.get('webauthn.timeoutMs'),
      userVerification: 'required',
      allowCredentials,
    })

    const flowId = randomUUID()
    await this.saveChallenge(flowId, {
      kind: 'login',
      challenge: options.challenge,
      userId,
    })

    return { flow_id: flowId, options }
  }

  async verifyLogin(
    flowId: string,
    response: AuthenticationResponseJSON,
    req: RequestWithUser,
  ): Promise<{ token: string; refresh_token: string }> {
    let state: Extract<ChallengeState, { kind: 'login' }>
    try {
      state = await this.consumeChallenge(flowId, 'login')
    } catch {
      throw new ShionBizException(
        ShionBizCode.AUTH_FORBIDDEN,
        'shion-biz.AUTH_FORBIDDEN',
        undefined,
        HttpStatus.FORBIDDEN,
      )
    }
    const credential = await this.prisma.userPasskeyCredential.findFirst({
      where: {
        credential_id: response.id,
        revoked_at: null,
      },
      include: {
        user: {
          select: {
            id: true,
            role: true,
            content_limit: true,
            status: true,
          },
        },
      },
    })

    if (!credential) {
      throw new ShionBizException(
        ShionBizCode.AUTH_FORBIDDEN,
        'shion-biz.AUTH_FORBIDDEN',
        undefined,
        HttpStatus.FORBIDDEN,
      )
    }
    if (state.userId && credential.user_id !== state.userId) {
      throw new ShionBizException(
        ShionBizCode.AUTH_FORBIDDEN,
        'shion-biz.AUTH_FORBIDDEN',
        undefined,
        HttpStatus.FORBIDDEN,
      )
    }
    if (credential.user.status === UserStatus.BANNED) {
      throw new ShionBizException(ShionBizCode.USER_BANNED, 'shion-biz.USER_BANNED')
    }

    let verification: Awaited<ReturnType<typeof verifyAuthenticationResponse>>
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: state.challenge,
        expectedOrigin: this.configService.get('webauthn.origins'),
        expectedRPID: this.configService.get('webauthn.rpId'),
        requireUserVerification: true,
        credential: {
          id: credential.credential_id,
          publicKey: this.fromBase64Url(credential.public_key),
          counter: credential.counter,
          transports: this.asTransports(credential.transports),
        },
      })
    } catch {
      throw new ShionBizException(
        ShionBizCode.AUTH_FORBIDDEN,
        'shion-biz.AUTH_FORBIDDEN',
        undefined,
        HttpStatus.FORBIDDEN,
      )
    }

    if (!verification.verified) {
      throw new ShionBizException(
        ShionBizCode.AUTH_FORBIDDEN,
        'shion-biz.AUTH_FORBIDDEN',
        undefined,
        HttpStatus.FORBIDDEN,
      )
    }

    await this.prisma.userPasskeyCredential.update({
      where: { id: credential.id },
      data: {
        counter: verification.authenticationInfo.newCounter,
        device_type: verification.authenticationInfo.credentialDeviceType,
        credential_backed_up: verification.authenticationInfo.credentialBackedUp,
        last_used_at: new Date(),
      },
    })

    const device = this.getDeviceSignals(req)
    const { token, refreshToken: refresh_token } = await this.loginSessionService.issueOnLogin(
      credential.user.id,
      device,
      credential.user.role,
      credential.user.content_limit,
    )
    await this.prisma.user.update({
      where: { id: credential.user.id },
      data: { last_login_at: new Date() },
    })

    return { token, refresh_token }
  }

  async listMyPasskeys(userId: number) {
    return this.prisma.userPasskeyCredential.findMany({
      where: { user_id: userId, revoked_at: null },
      orderBy: [{ last_used_at: 'desc' }, { created: 'desc' }],
      select: {
        id: true,
        credential_id: true,
        name: true,
        transports: true,
        aaguid: true,
        device_type: true,
        credential_backed_up: true,
        last_used_at: true,
        created: true,
      },
    })
  }

  async revokeMyPasskey(userId: number, id: number) {
    const existing = await this.prisma.userPasskeyCredential.findFirst({
      where: { id, user_id: userId, revoked_at: null },
      select: { id: true },
    })
    if (!existing) {
      throw new ShionBizException(
        ShionBizCode.USER_NOT_FOUND,
        'shion-biz.USER_NOT_FOUND',
        undefined,
        HttpStatus.NOT_FOUND,
      )
    }
    await this.prisma.userPasskeyCredential.update({
      where: { id },
      data: { revoked_at: new Date() },
    })
    const activeCount = await this.prisma.userPasskeyCredential.count({
      where: { user_id: userId, revoked_at: null },
    })
    if (activeCount === 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { two_factor_enabled: false },
      })
    }
    return { id }
  }

  private getDeviceSignals(req: RequestWithUser) {
    const ip = (req.headers['x-real-ip'] as string) || (req.headers['cf-connecting-ip'] as string)
    const user_agent = req.headers['user-agent']
    return { ip, user_agent }
  }

  private async saveChallenge(flowId: string, state: ChallengeState) {
    const ttlMs = Number(this.configService.get('webauthn.challengeTtlSec')) * 1000
    await this.cacheService.set(this.challengeKey(flowId), state, ttlMs)
  }

  private async consumeChallenge<T extends ChallengeState['kind']>(
    flowId: string,
    kind: T,
  ): Promise<Extract<ChallengeState, { kind: T }>> {
    const key = this.challengeKey(flowId)
    const state = await this.cacheService.get<ChallengeState | null>(key)
    await this.cacheService.del(key)
    if (!state || state.kind !== kind) {
      throw new ShionBizException(
        ShionBizCode.AUTH_UNAUTHORIZED,
        'shion-biz.AUTH_UNAUTHORIZED',
        undefined,
        HttpStatus.UNAUTHORIZED,
      )
    }
    return state as Extract<ChallengeState, { kind: T }>
  }

  private challengeKey(flowId: string) {
    return `auth:passkey:challenge:${flowId}`
  }

  private toBase64Url(input: Buffer) {
    return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  private fromBase64Url(value: string) {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    return Buffer.from(padded, 'base64')
  }

  private asTransports(transports?: string[] | null): AuthenticatorTransportFuture[] | undefined {
    if (!transports || transports.length === 0) return undefined
    return transports.filter(Boolean) as AuthenticatorTransportFuture[]
  }
}
