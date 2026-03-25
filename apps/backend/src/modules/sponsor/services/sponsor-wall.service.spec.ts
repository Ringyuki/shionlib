import { SponsorWallService } from './sponsor-wall.service'

describe('SponsorWallService', () => {
  const createService = () => {
    const prisma = {
      sponsorOrder: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
    }
    const cacheService = {
      delByContains: jest.fn(),
    }
    const service = new SponsorWallService(prisma as any, cacheService as any)
    return { prisma, cacheService, service }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getWall', () => {
    it('queries DB and returns paginated wall items', async () => {
      const { service, prisma } = createService()
      const paidAt = new Date('2025-01-01')
      prisma.sponsorOrder.findMany.mockResolvedValueOnce([
        {
          id: 1,
          sponsor_name: 'Alice',
          sponsor_message: 'Thanks!',
          user: { id: 10, name: 'alice', avatar: 'avatar.png', sponsor_expires_at: null },
          amount: 10,
          paid_at: paidAt,
        },
      ])
      prisma.sponsorOrder.count.mockResolvedValueOnce(1)

      const result = await service.getWall({ page: 1, pageSize: 10 })

      expect(result.items).toHaveLength(1)
      expect(result.items[0]).toEqual({
        id: 1,
        sponsorName: 'Alice',
        message: 'Thanks!',
        user: { id: 10, name: 'alice', avatar: 'avatar.png', is_sponsor: false },
        amount: 10,
        paidAt,
      })
      expect(result.meta.totalItems).toBe(1)
    })

    it('paginates correctly', async () => {
      const { service, prisma } = createService()
      prisma.sponsorOrder.findMany.mockResolvedValueOnce([])
      prisma.sponsorOrder.count.mockResolvedValueOnce(25)

      const result = await service.getWall({ page: 3, pageSize: 10 })

      expect(result.meta).toEqual({
        totalItems: 25,
        itemCount: 0,
        itemsPerPage: 10,
        totalPages: 3,
        currentPage: 3,
      })
      expect(prisma.sponsorOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      )
    })
  })

  describe('invalidateWallCache', () => {
    it('deletes all wall cache keys', async () => {
      const { service, cacheService } = createService()
      cacheService.delByContains.mockResolvedValueOnce(5)

      await service.invalidateWallCache()

      expect(cacheService.delByContains).toHaveBeenCalledWith('sponsor:wall')
    })
  })
})
