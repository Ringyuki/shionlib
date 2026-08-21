import { HikarinagiChangesService } from './hikarinagi-changes.service'
import { galgameBundleKey } from '../constants/cache-keys.constant'
import { GameService } from '../../game/services/game.service'

describe('HikarinagiChangesService', () => {
  const createService = (internalOverrides: Record<string, unknown> = {}) => {
    const prisma = {
      game: { findFirst: jest.fn().mockResolvedValue(null) },
      hikarinagiSyncState: {
        findUnique: jest.fn().mockResolvedValue({ last_event_id: 0n }),
        upsert: jest.fn(),
      },
    }
    const cache = { del: jest.fn(), delByContains: jest.fn() }
    const internal = {
      enabled: true,
      changes: jest.fn().mockResolvedValue({ items: [], has_more: false }),
      ...internalOverrides,
    }
    const config = { get: jest.fn().mockReturnValue(200) }
    const service = new HikarinagiChangesService(
      prisma as any,
      internal as any,
      cache as any,
      config as any,
    )

    return { service, cache, prisma, internal }
  }

  const apply = (service: HikarinagiChangesService, event: unknown) => {
    return (service as any).applyEvent(event)
  }

  it('invalidates the exact key GameService caches the bundle under', async () => {
    const { service, cache } = createService()
    const cached: string[] = []
    const gameService = Object.create(GameService.prototype) as GameService
    Object.assign(gameService, {
      cacheService: {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn((key: string) => {
          cached.push(key)
        }),
      },
      hikarinagi: { galgameDetail: jest.fn().mockResolvedValue({ galgame: { id: 42 } }) },
    })

    await (gameService as any).hikarinagiBundle(42)
    await apply(service, { resource_type: 'GALGAME', resource_id: 42, kind: 'UPSERT' })

    expect(cached).toEqual([galgameBundleKey(42)])
    expect(cache.del).toHaveBeenCalledWith(cached[0])
  })

  it('also invalidates the merge target', async () => {
    const { service, cache } = createService()

    await apply(service, {
      resource_type: 'GALGAME',
      resource_id: 7,
      kind: 'MERGE',
      merged_to_id: 9,
    })

    expect(cache.del).toHaveBeenCalledWith(galgameBundleKey(7))
    expect(cache.del).toHaveBeenCalledWith(galgameBundleKey(9))
  })

  it('drops every cached bundle when a character or producer changes', async () => {
    const { service, cache } = createService()

    await apply(service, { resource_type: 'CHARACTER', resource_id: 1, kind: 'UPSERT' })

    expect(cache.delByContains).toHaveBeenCalledWith(expect.stringContaining('galgame:detail'))
    expect(cache.del).not.toHaveBeenCalled()
  })

  describe('consume', () => {
    it('does nothing when the internal channel is not configured', async () => {
      const { service, internal } = createService({ enabled: false })

      await expect(service.consume()).resolves.toEqual({
        consumed: 0,
        applied: 0,
        failed: 0,
        cursor: 0,
      })
      expect(internal.changes).not.toHaveBeenCalled()
    })

    it('walks every page and advances the cursor per event', async () => {
      const { service, prisma, internal } = createService()
      internal.changes
        .mockResolvedValueOnce({
          items: [
            { id: 1, resource_type: 'GALGAME', resource_id: 10, kind: 'UPSERT' },
            { id: 2, resource_type: 'GALGAME', resource_id: 11, kind: 'UPSERT' },
          ],
          has_more: true,
        })
        .mockResolvedValueOnce({
          items: [{ id: 3, resource_type: 'GALGAME', resource_id: 12, kind: 'UPSERT' }],
          has_more: false,
        })

      const out = await service.consume()

      expect(out).toEqual({ consumed: 3, applied: 3, failed: 0, cursor: 3 })
      expect(prisma.hikarinagiSyncState.upsert).toHaveBeenCalledTimes(3)
    })

    it('counts a failing event without aborting the run', async () => {
      const { service, cache, internal } = createService()
      cache.del.mockRejectedValueOnce(new Error('redis down'))
      internal.changes.mockResolvedValueOnce({
        items: [
          { id: 1, resource_type: 'GALGAME', resource_id: 10, kind: 'UPSERT' },
          { id: 2, resource_type: 'GALGAME', resource_id: 11, kind: 'UPSERT' },
        ],
        has_more: false,
      })

      const out = await service.consume()

      expect(out.consumed).toBe(2)
      expect(out.failed).toBe(1)
      expect(out.applied).toBe(1)
      expect(out.cursor).toBe(2)
    })

    it('resumes from the stored cursor', async () => {
      const { service, prisma, internal } = createService()
      prisma.hikarinagiSyncState.findUnique.mockResolvedValueOnce({ last_event_id: 42n })

      await service.consume()

      expect(internal.changes).toHaveBeenCalledWith(42, 200)
    })
  })
})
