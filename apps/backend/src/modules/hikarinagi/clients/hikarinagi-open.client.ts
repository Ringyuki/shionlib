import { Injectable } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { AxiosError } from 'axios'
import { firstValueFrom } from 'rxjs'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { HikarinagiTokenService } from '../services/hikarinagi-token.service'
import { HikarinagiEnvelope } from '../interfaces/galgame-mapping.interface'
import {
  OpenCatalogChanges,
  OpenCharacterDetail,
  OpenGalgameCharacter,
  OpenGalgameDetail,
  OpenGalgameProducer,
  OpenGalgameRelation,
  OpenGalgameStaff,
  OpenProducerDetail,
} from '../interfaces/open-api.interface'

@Injectable()
export class HikarinagiOpenClient {
  private static readonly TIMEOUT_MS = 15000

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ShionConfigService,
    private readonly tokenService: HikarinagiTokenService,
  ) {}

  get enabled(): boolean {
    return Boolean(this.baseUrl) && this.tokenService.enabled
  }

  async changes(since: number, limit: number): Promise<OpenCatalogChanges> {
    return this.request<OpenCatalogChanges>(`/catalog/changes?since=${since}&limit=${limit}`)
  }

  async galgame(id: number): Promise<OpenGalgameDetail | null> {
    return this.requestOrNull<OpenGalgameDetail>(`/galgames/${id}`)
  }

  async galgameCharacters(id: number): Promise<OpenGalgameCharacter[]> {
    return (await this.requestOrNull<OpenGalgameCharacter[]>(`/galgames/${id}/characters`)) ?? []
  }

  async galgameStaff(id: number): Promise<OpenGalgameStaff[]> {
    return (await this.requestOrNull<OpenGalgameStaff[]>(`/galgames/${id}/staff`)) ?? []
  }

  async galgameProducers(id: number): Promise<OpenGalgameProducer[]> {
    return (await this.requestOrNull<OpenGalgameProducer[]>(`/galgames/${id}/producers`)) ?? []
  }

  async galgameRelations(id: number): Promise<OpenGalgameRelation[]> {
    return (await this.requestOrNull<OpenGalgameRelation[]>(`/galgames/${id}/relations`)) ?? []
  }

  async character(id: number): Promise<OpenCharacterDetail | null> {
    return this.requestOrNull<OpenCharacterDetail>(`/characters/${id}`)
  }

  async producer(id: number): Promise<OpenProducerDetail | null> {
    return this.requestOrNull<OpenProducerDetail>(`/producers/${id}`)
  }

  private get baseUrl(): string {
    return this.configService.get('hikarinagi.open_base_url').replace(/\/$/, '')
  }

  private async requestOrNull<T>(path: string): Promise<T | null> {
    try {
      return await this.request<T>(path)
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 404) return null
      throw error
    }
  }

  private async request<T>(path: string, retried = false): Promise<T> {
    const token = await this.tokenService.getToken()
    try {
      const response = await firstValueFrom(
        this.httpService.get<HikarinagiEnvelope<T>>(`${this.baseUrl}${path}`, {
          headers: { authorization: `Bearer ${token}` },
          timeout: HikarinagiOpenClient.TIMEOUT_MS,
        }),
      )
      return response.data.data
    } catch (error) {
      if (!retried && error instanceof AxiosError && error.response?.status === 401) {
        this.tokenService.invalidate()
        return this.request<T>(path, true)
      }
      if (error instanceof AxiosError && error.response?.status === 429) {
        const retryAfter = Number(error.response.headers['retry-after']) || 5
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
        return this.request<T>(path, retried)
      }
      throw error
    }
  }
}
