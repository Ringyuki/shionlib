import { Injectable } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { firstValueFrom } from 'rxjs'
import { B2Auth, B2DownloadAuth } from '../interfaces/b2-auth.interface'
import { CacheService } from '../../cache/services/cache.service'

@Injectable()
export class B2Service {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ShionConfigService,
    private readonly cacheService: CacheService,
  ) {}

  private async getAuthorizationToken() {
    const cacheKey = 'b2:authorizationToken'
    const cachedToken = await this.cacheService.get<B2Auth>(cacheKey)
    if (cachedToken) {
      return {
        authorizationToken: cachedToken.authorizationToken,
        bucketId: cachedToken.apiInfo.storageApi.allowed.buckets[0].id,
        apiUrl: cachedToken.apiInfo.storageApi.apiUrl,
      }
    }

    const response = await firstValueFrom(
      this.httpService.get<B2Auth>('https://api.backblazeb2.com/b2api/v4/b2_authorize_account', {
        headers: {
          Authorization: `Basic ${btoa(`${this.configService.get('b2.applicationKeyId')}:${this.configService.get('b2.applicationKey')}`)}`,
        },
      }),
    )

    await this.cacheService.set(cacheKey, response.data, 3600 * 1000 * 21)

    return {
      authorizationToken: response.data.authorizationToken,
      bucketId: response.data.apiInfo.storageApi.allowed.buckets[0].id,
      apiUrl: response.data.apiInfo.storageApi.apiUrl,
    }
  }

  private async getDownloadAuthorizationToken(key: string, expiresIn?: number) {
    const authInfo = await this.getAuthorizationToken()
    const response = await firstValueFrom(
      this.httpService.post<B2DownloadAuth>(
        `${authInfo.apiUrl}/b2api/v4/b2_get_download_authorization`,
        {
          bucketId: authInfo.bucketId,
          fileNamePrefix: key,
          validDurationInSeconds:
            expiresIn ?? this.configService.get('file_download.download_expires_in'),
        },
        {
          headers: {
            Authorization: authInfo.authorizationToken,
            'Content-Type': 'application/json',
          },
        },
      ),
    )

    return response.data.authorizationToken
  }

  async getDownloadUrl(key: string, expiresIn?: number) {
    try {
      const authToken = await this.getDownloadAuthorizationToken(key, expiresIn)
      const cdn = this.configService.get('file_download.download_cdn_host')
      const cdnHost = cdn.endsWith('/') ? cdn : `${cdn}/`
      return `${cdnHost}${encodeURIComponent(key)}?Authorization=${authToken}`
    } catch (error) {
      console.error(`Error getting download URL for key: ${key}`, error)
      throw error
    }
  }
}
