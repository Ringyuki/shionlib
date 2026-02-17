import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { HttpService } from '@nestjs/axios'
import { promises as fs } from 'fs'
import { join } from 'path'
import { firstValueFrom } from 'rxjs'
import { OAuthConfig } from '../interfaces/oauth-config.interface'
import { BangumiTokens } from '../interfaces/bangumi-tokens.interface'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'

@Injectable()
export class BangumiAuthService implements OnModuleInit {
  private readonly logger = new Logger(BangumiAuthService.name)
  private readonly TOKEN_URL = 'https://bgm.tv/oauth/access_token'
  private readonly TOKEN_FILE: string
  private readonly oauthConfig: OAuthConfig

  private tokens: BangumiTokens | null = null
  private refreshPromise: Promise<BangumiTokens> | null = null
  constructor(
    private readonly configService: ShionConfigService,
    private readonly httpService: HttpService,
  ) {
    this.TOKEN_FILE = join(process.cwd(), 'config', 'bangumi-tokens.json')
    this.oauthConfig = {
      clientId: this.configService.get('bangumi.clientId'),
      clientSecret: this.configService.get('bangumi.clientSecret'),
    }

    if (!this.oauthConfig.clientId || !this.oauthConfig.clientSecret) {
      this.logger.error('Bangumi OAuth credentials not configured')
    }
  }

  async onModuleInit() {
    try {
      await this.loadTokens()
      this.logger.log('Bangumi tokens loaded successfully')
    } catch (error) {
      this.logger.warn('Failed to load Bangumi tokens on startup', error.message)
    }
  }

  async loadTokens(): Promise<BangumiTokens> {
    try {
      const data = await fs.readFile(this.TOKEN_FILE, 'utf8')
      this.tokens = JSON.parse(data) as BangumiTokens

      if (this.isTokenExpired(this.tokens)) {
        this.logger.log('Token expired, attempting refresh...')
        return await this.refreshAccessToken()
      }

      return this.tokens
    } catch (error) {
      this.logger.error('Error loading tokens:', error.message)
      throw new Error('No valid tokens found. Please complete OAuth flow first.')
    }
  }

  private async saveTokens(tokens: BangumiTokens): Promise<void> {
    try {
      await fs.mkdir(join(process.cwd(), 'config'), { recursive: true })

      const tokensWithExpiry = {
        ...tokens,
        expires_at: tokens.expires_at || Date.now() + (tokens.expires_in || 0) * 1000,
        saved_at: Date.now(),
      }

      await fs.writeFile(this.TOKEN_FILE, JSON.stringify(tokensWithExpiry, null, 2))
      this.tokens = tokensWithExpiry
      this.logger.log('Tokens saved successfully')
    } catch (error) {
      this.logger.error('Error saving tokens:', error.message)
      throw error
    }
  }

  private isTokenExpired(tokens: BangumiTokens): boolean {
    if (!tokens?.expires_at) return true
    return Date.now() > tokens.expires_at - 300000 // 5 mins before expiration
  }

  async refreshAccessToken(refreshToken?: string): Promise<BangumiTokens> {
    if (this.refreshPromise) {
      return await this.refreshPromise
    }
    this.refreshPromise = this._doRefreshToken(refreshToken)
    try {
      const result = await this.refreshPromise
      return result
    } finally {
      this.refreshPromise = null
    }
  }

  private async _doRefreshToken(refreshToken?: string): Promise<BangumiTokens> {
    const tokenToUse = refreshToken || this.tokens?.refresh_token

    if (!tokenToUse) {
      this.logger.error('No refresh token available')
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          this.TOKEN_URL,
          {
            grant_type: 'refresh_token',
            client_id: this.oauthConfig.clientId,
            client_secret: this.oauthConfig.clientSecret,
            refresh_token: tokenToUse,
          },
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; ShionLib/1.0)',
              Accept: 'application/json',
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        ),
      )

      if (response.status === 200) {
        const tokens: BangumiTokens = {
          access_token: response.data.access_token,
          refresh_token: response.data.refresh_token,
          token_type: response.data.token_type || 'Bearer',
          expires_in: response.data.expires_in, // seconds
          expires_at: Date.now() + response.data.expires_in * 1000, // milliseconds
        }

        await this.saveTokens(tokens)
        this.logger.log('Successfully refreshed access token')
        return tokens
      }

      throw new Error(`Token refresh failed: ${response.status}`)
    } catch (error) {
      this.logger.error('Error refreshing token:', error.message)
      throw error
    }
  }

  async getValidAccessToken(): Promise<string> {
    if (!this.tokens) {
      await this.loadTokens()
    }

    if (this.isTokenExpired(this.tokens!)) {
      await this.refreshAccessToken()
    }
    return this.tokens!.access_token
  }

  async clearTokens(): Promise<void> {
    try {
      await fs.unlink(this.TOKEN_FILE)
      this.tokens = null
      this.logger.log('Tokens cleared successfully')
    } catch (error) {
      this.logger.warn('Failed to clear tokens:', error.message)
    }
  }

  getTokenInfo(): { hasToken: boolean; expiresAt?: number; tokenType?: string } {
    if (!this.tokens) {
      return { hasToken: false }
    }

    return {
      hasToken: true,
      expiresAt: this.tokens.expires_at,
      tokenType: this.tokens.token_type,
    }
  }

  async bangumiRequest<T>(
    url: string,
    method: 'GET' | 'POST' = 'GET',
    params?: Record<string, any>,
    data?: any,
  ): Promise<T> {
    const accessToken = await this.getValidAccessToken()
    const headers = {
      'User-Agent': 'shionlib/shionlib-backend',
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    }
    try {
      const res = await firstValueFrom(
        this.httpService.request({
          url,
          method,
          params,
          data,
          headers,
        }),
      )
      return res.data as T
    } catch (error) {
      this.logger.error(`Error making Bangumi request: ${error.message}`)
      throw new ShionBizException(
        ShionBizCode.GAME_BANGUMI_REQUEST_FAILED,
        'shion-biz.GAME_BANGUMI_REQUEST_FAILED',
        { message: error.message },
      )
    }
  }
}
