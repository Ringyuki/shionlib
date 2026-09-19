import { AxiosError, AxiosHeaders } from 'axios'
import { MoyuPatchService } from './moyu-patch.service'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import {
  MOYU_PATCH_RESOURCES_CACHE_TTL_MS,
  moyuPatchResourcesKey,
} from '../constants/cache-keys.constant'

describe('MoyuPatchService', () => {
  const resource = { id: '10463', patch_id: '11617', name: 'patch.7z' }

  const createService = (vId: string | null = 'v4145') => {
    const prisma = {
      game: { findUnique: jest.fn().mockResolvedValue({ v_id: vId }) },
    }
    const moyuClient = { patchByVndbId: jest.fn() }
    const cacheService = { get: jest.fn().mockResolvedValue(undefined), set: jest.fn() }
    const service = new MoyuPatchService(
      prisma as never,
      moyuClient as never,
      cacheService as never,
    )

    return { service, prisma, moyuClient, cacheService }
  }

  const expectBizCode = async (promise: Promise<unknown>, code: ShionBizCode) => {
    await expect(promise).rejects.toMatchObject({ code })
  }

  it('answers the resources moyu holds for the game and caches them', async () => {
    const { service, moyuClient, cacheService } = createService()
    moyuClient.patchByVndbId.mockResolvedValue({ id: '11617', resources: [resource] })

    await expect(service.getResourcesByGameId(1)).resolves.toEqual([resource])

    expect(moyuClient.patchByVndbId).toHaveBeenCalledWith('v4145')
    expect(cacheService.set).toHaveBeenCalledWith(
      moyuPatchResourcesKey('v4145'),
      { resources: [resource] },
      MOYU_PATCH_RESOURCES_CACHE_TTL_MS,
    )
  })

  it('answers an empty list for a page that has no live resources', async () => {
    const { service, moyuClient } = createService()
    moyuClient.patchByVndbId.mockResolvedValue({ id: '11617', resources: [] })

    await expect(service.getResourcesByGameId(1)).resolves.toEqual([])
  })

  it('serves a cached answer without asking moyu', async () => {
    const { service, moyuClient, cacheService } = createService()
    cacheService.get.mockResolvedValue({ resources: [resource] })

    await expect(service.getResourcesByGameId(1)).resolves.toEqual([resource])
    expect(moyuClient.patchByVndbId).not.toHaveBeenCalled()
  })

  it('caches a miss and reports it as not found', async () => {
    const { service, moyuClient, cacheService } = createService()
    moyuClient.patchByVndbId.mockResolvedValue(null)

    await expectBizCode(service.getResourcesByGameId(1), ShionBizCode.MOYU_PATCH_NOT_FOUND)
    expect(cacheService.set).toHaveBeenCalledWith(
      moyuPatchResourcesKey('v4145'),
      { resources: null },
      MOYU_PATCH_RESOURCES_CACHE_TTL_MS,
    )
  })

  it('reports a cached miss as not found', async () => {
    const { service, moyuClient, cacheService } = createService()
    cacheService.get.mockResolvedValue({ resources: null })

    await expectBizCode(service.getResourcesByGameId(1), ShionBizCode.MOYU_PATCH_NOT_FOUND)
    expect(moyuClient.patchByVndbId).not.toHaveBeenCalled()
  })

  it('reports a game without a vndb id, or no game at all, as not found', async () => {
    const noVndb = createService(null)
    await expectBizCode(noVndb.service.getResourcesByGameId(1), ShionBizCode.MOYU_PATCH_NOT_FOUND)
    expect(noVndb.moyuClient.patchByVndbId).not.toHaveBeenCalled()

    const noGame = createService()
    noGame.prisma.game.findUnique.mockResolvedValue(null)
    await expectBizCode(noGame.service.getResourcesByGameId(1), ShionBizCode.MOYU_PATCH_NOT_FOUND)
  })

  it('turns an upstream failure into a request-failed error and does not cache it', async () => {
    const { service, moyuClient, cacheService } = createService()
    moyuClient.patchByVndbId.mockRejectedValue(
      new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 429,
        statusText: 'Too Many Requests',
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: { code: 'RATE_LIMITED' },
      }),
    )

    await expectBizCode(service.getResourcesByGameId(1), ShionBizCode.MOYU_REQUEST_FAILED)
    expect(cacheService.set).not.toHaveBeenCalled()
  })
})
