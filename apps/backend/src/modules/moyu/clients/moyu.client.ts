import { Injectable } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { firstValueFrom } from 'rxjs'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { MoyuPatch, MoyuPatchList } from '../interfaces/moyu-patch.interface'

@Injectable()
export class MoyuClient {
  private static readonly TIMEOUT_MS = 10000

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ShionConfigService,
  ) {}

  async patchByVndbId(vndbId: string): Promise<MoyuPatch | null> {
    const search = new URLSearchParams({
      refs: `vndb:${vndbId}`,
      nsfw: 'true',
      include: 'resources,publisher',
    })
    const response = await firstValueFrom(
      this.httpService.get<MoyuPatchList>(`${this.baseUrl}/v2/moyu/patches?${search.toString()}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        timeout: MoyuClient.TIMEOUT_MS,
      }),
    )

    return response.data.items[0] ?? null
  }

  private get baseUrl(): string {
    return this.configService.get('nextmoe.baseUrl').replace(/\/$/, '')
  }

  private get apiKey(): string {
    return this.configService.get('nextmoe.apiKey')
  }
}
