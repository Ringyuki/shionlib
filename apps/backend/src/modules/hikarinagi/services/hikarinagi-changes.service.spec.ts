import { HikarinagiChangesService } from './hikarinagi-changes.service'
import { galgameBundleKey } from '../constants/cache-keys.constant'
import { GameService } from '../../game/services/game.service'

describe('HikarinagiChangesService', () => {
  const createService = () => {
    const prisma = { game: { findFirst: jest.fn().mockResolvedValue(null) } }
    const cache = { del: jest.fn(), delByContains: jest.fn() }
    const service = new HikarinagiChangesService(
      prisma as any,
      { enabled: true } as any,
      cache as any,
      { get: jest.fn() } as any,
    )

    return { service, cache, prisma }
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
})
