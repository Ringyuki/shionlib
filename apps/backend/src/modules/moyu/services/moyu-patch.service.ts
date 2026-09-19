import { Injectable, Logger } from '@nestjs/common'
import { AxiosError } from 'axios'
import { PrismaService } from '../../../prisma.service'
import { CacheService } from '../../cache/services/cache.service'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { MoyuClient } from '../clients/moyu.client'
import { MoyuPatch, MoyuPatchResource } from '../interfaces/moyu-patch.interface'
import {
  MOYU_PATCH_RESOURCES_CACHE_TTL_MS,
  moyuPatchResourcesKey,
} from '../constants/cache-keys.constant'

interface CachedPatchResources {
  resources: MoyuPatchResource[] | null
}

@Injectable()
export class MoyuPatchService {
  private readonly logger = new Logger(MoyuPatchService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly moyuClient: MoyuClient,
    private readonly cacheService: CacheService,
  ) {}

  async getResourcesByGameId(gameId: number): Promise<MoyuPatchResource[]> {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      select: { v_id: true },
    })
    const resources = game?.v_id ? await this.getResourcesByVndbId(game.v_id) : null
    if (!resources) {
      throw new ShionBizException(
        ShionBizCode.MOYU_PATCH_NOT_FOUND,
        'shion-biz.MOYU_PATCH_NOT_FOUND',
      )
    }

    return resources
  }

  private async getResourcesByVndbId(vndbId: string): Promise<MoyuPatchResource[] | null> {
    const cacheKey = moyuPatchResourcesKey(vndbId)
    const cached = await this.cacheService.get<CachedPatchResources | null>(cacheKey)
    if (cached) return cached.resources

    let patch: MoyuPatch | null
    try {
      patch = await this.moyuClient.patchByVndbId(vndbId)
    } catch (error) {
      this.logger.error(`moyu patch lookup failed for ${vndbId}: ${describeError(error)}`)
      throw new ShionBizException(ShionBizCode.MOYU_REQUEST_FAILED, 'shion-biz.MOYU_REQUEST_FAILED')
    }

    const resources = patch ? (patch.resources ?? []) : null
    await this.cacheService.set<CachedPatchResources>(
      cacheKey,
      { resources },
      MOYU_PATCH_RESOURCES_CACHE_TTL_MS,
    )

    return resources
  }
}

const describeError = (error: unknown): string => {
  if (error instanceof AxiosError && error.response) {
    const code = (error.response.data as { code?: string } | undefined)?.code
    return `HTTP ${error.response.status}${code ? ` ${code}` : ''}`
  }

  return error instanceof Error ? error.message : String(error)
}
