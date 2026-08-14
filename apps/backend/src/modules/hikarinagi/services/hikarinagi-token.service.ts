import { Injectable } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { firstValueFrom } from 'rxjs'
import { ShionConfigService } from '../../../common/config/services/config.service'

interface TokenResponse {
  access_token: string
  expires_in: number
}

@Injectable()
export class HikarinagiTokenService {
  private static readonly TIMEOUT_MS = 10000
  private static readonly REFRESH_MARGIN_MS = 60000

  private token: string | null = null
  private expiresAt = 0

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ShionConfigService,
  ) {}

  get enabled(): boolean {
    return Boolean(
      this.configService.get('hikarinagi.token_url') &&
      this.configService.get('hikarinagi.client_id') &&
      this.configService.get('hikarinagi.client_secret'),
    )
  }

  async getToken(): Promise<string> {
    if (this.token && Date.now() < this.expiresAt - HikarinagiTokenService.REFRESH_MARGIN_MS) {
      return this.token
    }

    const clientId = this.configService.get('hikarinagi.client_id')
    const clientSecret = this.configService.get('hikarinagi.client_secret')
    const basic = Buffer.from(
      `${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`,
    ).toString('base64')

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'catalog:read catalog:full',
    })
    const response = await firstValueFrom(
      this.httpService.post<TokenResponse>(
        this.configService.get('hikarinagi.token_url'),
        body.toString(),
        {
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            authorization: `Basic ${basic}`,
          },
          timeout: HikarinagiTokenService.TIMEOUT_MS,
        },
      ),
    )

    this.token = response.data.access_token
    this.expiresAt = Date.now() + response.data.expires_in * 1000
    return this.token
  }

  invalidate(): void {
    this.token = null
    this.expiresAt = 0
  }
}
