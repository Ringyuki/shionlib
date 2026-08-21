import { Injectable } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { AxiosError } from 'axios'
import { firstValueFrom } from 'rxjs'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { UserContentLimit } from '../../user/interfaces/user.interface'
import { createHash } from 'node:crypto'
import { CacheService } from '../../cache/services/cache.service'
import { includesRated } from '../../user/helpers/content-limit.helper'
import { GALGAME_IDS_CACHE_TTL_MS, GALGAME_IDS_KEY_PREFIX } from '../constants/cache-keys.constant'
import {
  CatalogChanges,
  InternalGalgameBundle,
  InternalGalgameCard,
  GalgameMappingEntry,
  GalgameMappingMeta,
  HikarinagiEnvelope,
  HikarinagiGalgameIdsQuery,
} from '../interfaces/galgame-mapping.interface'

@Injectable()
export class HikarinagiClient {
  private static readonly TIMEOUT_MS = 10000

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ShionConfigService,
    private readonly cacheService: CacheService,
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

  async changes(since: number, limit: number): Promise<CatalogChanges> {
    const envelope = await this.request<CatalogChanges>(
      `/api/v3/internal/catalog/changes?since=${since}&limit=${limit}`,
    )

    return envelope.data
  }

  async galgameDetail(hikarinagiId: number): Promise<InternalGalgameBundle | null> {
    if (!this.enabled) return null

    try {
      const envelope = await this.request<InternalGalgameBundle>(
        `/api/v3/internal/galgames/${hikarinagiId}/detail`,
      )

      return envelope.data ?? null
    } catch (error) {
      if (isAxiosNotFound(error)) return null
      throw error
    }
  }

  async galgameBatch(hikarinagiIds: number[]): Promise<InternalGalgameCard[]> {
    if (!this.enabled || !hikarinagiIds.length) return []
    const response = await firstValueFrom(
      this.httpService.post<HikarinagiEnvelope<InternalGalgameCard[]>>(
        `${this.baseUrl}/api/v3/internal/galgames/batch`,
        { ids: hikarinagiIds },
        { headers: { 'x-internal-secret': this.secret }, timeout: HikarinagiClient.TIMEOUT_MS },
      ),
    )

    return response.data.data ?? []
  }

  async searchGalgameIds(params: {
    q: string
    page: number
    page_size: number
    content_limit?: number
  }): Promise<{ ids: number[]; meta: { total_items: number; total_pages: number } }> {
    if (!this.enabled) return { ids: [], meta: { total_items: 0, total_pages: 0 } }

    const search = new URLSearchParams({
      q: params.q,
      page: String(params.page),
      page_size: String(params.page_size),
    })
    search.set('content_limit', hikarinagiContentLimit(params.content_limit))
    const envelope = await this.request<{
      ids: number[]
      meta: { total_items: number; total_pages: number }
    }>(`/api/v3/internal/galgames/search?${search.toString()}`)

    return envelope.data ?? { ids: [], meta: { total_items: 0, total_pages: 0 } }
  }

  async character(hikarinagiId: number): Promise<Record<string, unknown> | null> {
    if (!this.enabled) return null

    try {
      const envelope = await this.request<Record<string, unknown>>(
        `/api/v3/internal/characters/${hikarinagiId}`,
      )

      return envelope.data ?? null
    } catch (error) {
      if (isAxiosNotFound(error)) return null
      throw error
    }
  }

  async producer(hikarinagiId: number): Promise<Record<string, unknown> | null> {
    if (!this.enabled) return null

    try {
      const envelope = await this.request<Record<string, unknown>>(
        `/api/v3/internal/producers/${hikarinagiId}`,
      )

      return envelope.data ?? null
    } catch (error) {
      if (isAxiosNotFound(error)) return null
      throw error
    }
  }

  async entityMapping(
    kind: 'character' | 'producer',
    page: number,
    pageSize: number,
  ): Promise<{
    items: { id: number; vndb_id: string | null; bangumi_id: string | null }[]
    meta: GalgameMappingMeta | null
  }> {
    const segment = kind === 'character' ? 'characters' : 'producers'
    const envelope = await this.request<{
      items: { id: number; vndb_id: string | null; bangumi_id: string | null }[]
      meta?: GalgameMappingMeta
    }>(`/api/v3/internal/${segment}/mapping?page=${page}&page_size=${pageSize}`)

    return { items: envelope.data?.items ?? [], meta: envelope.data?.meta ?? null }
  }

  async galgameIds(params: HikarinagiGalgameIdsQuery): Promise<{ ids: number[] }> {
    if (!this.enabled) return { ids: [] }

    const cacheKey = `${GALGAME_IDS_KEY_PREFIX}${createHash('sha1').update(JSON.stringify(params)).digest('hex')}`
    const cached = await this.cacheService.get<number[] | null>(cacheKey)
    if (cached) return { ids: cached }

    const search = new URLSearchParams()
    const put = (key: string, value: string | undefined) => {
      if (value) search.set(key, value)
    }
    put('producer_ids', params.producer_id ? String(params.producer_id) : undefined)
    put('character_id', params.character_id ? String(params.character_id) : undefined)
    put('content_limit', hikarinagiContentLimit(params.content_limit))
    put('tags', params.tags?.join(','))
    put('exclude_tags', params.exclude_tags?.join(','))
    put('platforms', params.platforms?.join(','))
    put('release_periods', params.release_periods?.join(','))
    put('released_after', params.released_after)
    put('released_before', params.released_before)
    put('sort_order', params.sort_order)
    if (params.exclude_rated_covers) search.set('exclude_rated_covers', 'true')

    const envelope = await this.request<{ ids: number[] }>(
      `/api/v3/internal/galgames/ids?${search.toString()}`,
    )
    const ids = envelope.data?.ids ?? []
    await this.cacheService.set(cacheKey, ids, GALGAME_IDS_CACHE_TTL_MS)

    return { ids }
  }

  async safeGalgameIds(content_limit?: number): Promise<number[] | null> {
    if (!this.enabled) return []
    if (includesRated(content_limit)) return null

    const { ids } = await this.galgameIds({ content_limit, exclude_rated_covers: true })

    return ids
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

function isAxiosNotFound(error: unknown): boolean {
  return error instanceof AxiosError && error.response?.status === 404
}

const hikarinagiContentLimit = (limit?: number): string => {
  if (limit === UserContentLimit.JUST_SHOW) return 'JUST_SHOW'
  if (limit === UserContentLimit.SHOW_WITH_SPOILER) return 'SHOW_WITH_SPOILER'

  return 'NEVER_SHOW_NSFW_CONTENT'
}
