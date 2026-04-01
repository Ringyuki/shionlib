import { AdService } from './ad.service'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'

describe('AdService', () => {
  const createService = () => {
    const prisma = {
      ad: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    }
    const cacheService = {
      delByContains: jest.fn().mockResolvedValue(0),
    }

    const service = new AdService(prisma as any, cacheService as any)
    return { prisma, cacheService, service }
  }

  beforeEach(() => jest.clearAllMocks())

  describe('getAdsByPlacement', () => {
    it('returns active ads filtered by placement, enabled, and time range', async () => {
      const { service, prisma } = createService()
      const ads = [{ id: 1, image_zh: 'url', aspect: '6/1', link: 'link', exclude_locales: [] }]
      prisma.ad.findMany.mockResolvedValue(ads)

      const result = await service.getAdsByPlacement('home-after-hot')

      expect(result).toEqual(ads)
      expect(prisma.ad.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            placement: { has: 'home-after-hot' },
            enabled: true,
          }),
          orderBy: { sort: 'asc' },
          select: expect.objectContaining({ id: true, image_zh: true, link: true }),
        }),
      )
    })
  })

  describe('getAdList', () => {
    it('returns paginated list with filters', async () => {
      const { service, prisma } = createService()
      const items = [{ id: 1, name: 'ad1' }]
      prisma.ad.findMany.mockResolvedValue(items)
      prisma.ad.count.mockResolvedValue(1)

      const result = await service.getAdList({
        page: 1,
        pageSize: 10,
        placement: 'home',
        enabled: true,
        sortBy: 'id',
        sortOrder: 'desc',
      })

      expect(result.items).toEqual(items)
      expect(result.meta.totalItems).toBe(1)
      expect(result.meta.currentPage).toBe(1)
      expect(prisma.ad.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { placement: { has: 'home' }, enabled: true },
          orderBy: { id: 'desc' },
          skip: 0,
          take: 10,
        }),
      )
    })

    it('applies no filters when none provided', async () => {
      const { service, prisma } = createService()
      prisma.ad.findMany.mockResolvedValue([])
      prisma.ad.count.mockResolvedValue(0)

      await service.getAdList({ page: 1, pageSize: 10 })

      expect(prisma.ad.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }))
    })
  })

  describe('getAdDetail', () => {
    it('returns ad when found', async () => {
      const { service, prisma } = createService()
      const ad = { id: 1, name: 'test' }
      prisma.ad.findUnique.mockResolvedValue(ad)

      expect(await service.getAdDetail(1)).toEqual(ad)
    })

    it('throws AD_NOT_FOUND when not found', async () => {
      const { service, prisma } = createService()
      prisma.ad.findUnique.mockResolvedValue(null)

      await expect(service.getAdDetail(999)).rejects.toMatchObject({
        code: ShionBizCode.AD_NOT_FOUND,
      })
    })
  })

  describe('createAd', () => {
    it('creates ad and invalidates cache', async () => {
      const { service, prisma, cacheService } = createService()
      const created = { id: 1, name: 'new-ad' }
      prisma.ad.create.mockResolvedValue(created)

      const result = await service.createAd({
        name: 'new-ad',
        placement: ['home'],
        image_zh: 'https://example.com/img.webp',
        aspect: '6/1',
        link: 'https://example.com',
      })

      expect(result).toEqual(created)
      expect(prisma.ad.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'new-ad', placement: ['home'] }),
        }),
      )
      expect(cacheService.delByContains).toHaveBeenCalledWith('ad:')
    })

    it('converts date strings when provided', async () => {
      const { service, prisma } = createService()
      prisma.ad.create.mockResolvedValue({ id: 1 })

      await service.createAd({
        name: 'ad',
        placement: ['home'],
        image_zh: 'https://example.com/img.webp',
        aspect: '6/1',
        link: 'https://example.com',
        start_at: '2026-01-01T00:00:00Z',
        end_at: '2026-12-31T00:00:00Z',
      })

      expect(prisma.ad.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            start_at: new Date('2026-01-01T00:00:00Z'),
            end_at: new Date('2026-12-31T00:00:00Z'),
          }),
        }),
      )
    })

    it('sets defaults for optional fields', async () => {
      const { service, prisma } = createService()
      prisma.ad.create.mockResolvedValue({ id: 1 })

      await service.createAd({
        name: 'ad',
        placement: ['home'],
        image_zh: 'https://example.com/img.webp',
        aspect: '6/1',
        link: 'https://example.com',
      })

      expect(prisma.ad.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            exclude_locales: [],
            enabled: true,
            sort: 0,
            start_at: null,
            end_at: null,
          }),
        }),
      )
    })
  })

  describe('updateAd', () => {
    it('updates ad and invalidates cache', async () => {
      const { service, prisma, cacheService } = createService()
      prisma.ad.findUnique.mockResolvedValue({ id: 1 })
      prisma.ad.update.mockResolvedValue({ id: 1, name: 'updated' })

      const result = await service.updateAd(1, { name: 'updated' })

      expect(result).toEqual({ id: 1, name: 'updated' })
      expect(prisma.ad.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { name: 'updated' },
      })
      expect(cacheService.delByContains).toHaveBeenCalledWith('ad:')
    })

    it('throws AD_NOT_FOUND if ad does not exist', async () => {
      const { service, prisma } = createService()
      prisma.ad.findUnique.mockResolvedValue(null)

      await expect(service.updateAd(999, { name: 'x' })).rejects.toMatchObject({
        code: ShionBizCode.AD_NOT_FOUND,
      })
    })

    it('updates all fields when provided', async () => {
      const { service, prisma } = createService()
      prisma.ad.findUnique.mockResolvedValue({ id: 1 })
      prisma.ad.update.mockResolvedValue({ id: 1 })

      await service.updateAd(1, {
        name: 'n',
        placement: ['p'],
        image_zh: 'https://zh.webp',
        image_ja: 'https://ja.webp',
        image_en: 'https://en.webp',
        aspect: '4/1',
        link: 'https://link.com',
        exclude_locales: ['en'],
        enabled: false,
        sort: 5,
        start_at: '2026-01-01T00:00:00Z',
        end_at: '2026-12-31T00:00:00Z',
      })

      expect(prisma.ad.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          name: 'n',
          placement: ['p'],
          image_zh: 'https://zh.webp',
          image_ja: 'https://ja.webp',
          image_en: 'https://en.webp',
          aspect: '4/1',
          link: 'https://link.com',
          exclude_locales: ['en'],
          enabled: false,
          sort: 5,
          start_at: new Date('2026-01-01T00:00:00Z'),
          end_at: new Date('2026-12-31T00:00:00Z'),
        },
      })
    })

    it('converts empty date strings to null', async () => {
      const { service, prisma } = createService()
      prisma.ad.findUnique.mockResolvedValue({ id: 1 })
      prisma.ad.update.mockResolvedValue({ id: 1 })

      await service.updateAd(1, { start_at: '', end_at: '' })

      expect(prisma.ad.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          start_at: null,
          end_at: null,
        }),
      })
    })
  })

  describe('deleteAd', () => {
    it('deletes ad and invalidates cache', async () => {
      const { service, prisma, cacheService } = createService()
      prisma.ad.findUnique.mockResolvedValue({ id: 1 })
      prisma.ad.delete.mockResolvedValue({ id: 1 })

      await service.deleteAd(1)

      expect(prisma.ad.delete).toHaveBeenCalledWith({ where: { id: 1 } })
      expect(cacheService.delByContains).toHaveBeenCalledWith('ad:')
    })

    it('throws AD_NOT_FOUND if ad does not exist', async () => {
      const { service, prisma } = createService()
      prisma.ad.findUnique.mockResolvedValue(null)

      await expect(service.deleteAd(999)).rejects.toMatchObject({
        code: ShionBizCode.AD_NOT_FOUND,
      })
    })
  })

  describe('invalidateCache', () => {
    it('deletes all ad cache keys', async () => {
      const { service, cacheService } = createService()

      await service.invalidateCache()

      expect(cacheService.delByContains).toHaveBeenCalledWith('ad:')
    })
  })
})
