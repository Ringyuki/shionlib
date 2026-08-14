import { Injectable } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { firstValueFrom } from 'rxjs'
import { ShionConfigService } from '../../../common/config/services/config.service'
import {
  GalgameMappingEntry,
  GalgameMappingMeta,
  HikarinagiEnvelope,
} from '../interfaces/galgame-mapping.interface'

@Injectable()
export class HikarinagiClient {
  private static readonly TIMEOUT_MS = 10000

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ShionConfigService,
  ) {}

  get enabled(): boolean {
    return Boolean(this.baseUrl && this.secret)
  }

  async getMapping(page: number, pageSize: number) {
    const envelope = await this.request<{
      items: GalgameMappingEntry[]
      meta?: GalgameMappingMeta
    }>(`/api/v3/internal/galgames/mapping?page=${page}&page_size=${pageSize}`)

    return {
      items: envelope.data?.items ?? [],
      meta: envelope.data?.meta ?? null,
    }
  }

  async lookupById(hikarinagiId: number) {
    const envelope = await this.request<GalgameMappingEntry | null>(
      `/api/v3/internal/galgames/lookup?id=${hikarinagiId}`,
    )

    return envelope.data ?? null
  }

  async lookupByBangumiId(bangumiId: number) {
    const envelope = await this.request<GalgameMappingEntry | null>(
      `/api/v3/internal/galgames/lookup?bangumi_game_id=${bangumiId}`,
    )

    return envelope.data ?? null
  }

  private get baseUrl(): string {
    return this.configService.get('hikarinagi.base_url').replace(/\/$/, '')
  }

  private get secret(): string {
    return this.configService.get('partner.secret')
  }

  private async request<T>(path: string): Promise<HikarinagiEnvelope<T>> {
    const response = await firstValueFrom(
      this.httpService.get<HikarinagiEnvelope<T>>(`${this.baseUrl}${path}`, {
        headers: { 'x-internal-secret': this.secret },
        timeout: HikarinagiClient.TIMEOUT_MS,
      }),
    )

    return response.data
  }
}
