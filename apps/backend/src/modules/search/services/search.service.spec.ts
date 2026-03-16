import { SearchService } from './search.service'

describe('SearchService', () => {
  const createService = (overrides: { prisma?: any; searchEngine?: any } = {}) => {
    const searchEngine = overrides.searchEngine ?? {
      searchGames: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    }
    const prisma = overrides.prisma ?? {
      tag: { findMany: jest.fn().mockResolvedValue([]) },
    }
    return { service: new SearchService(searchEngine as any, prisma as any), searchEngine, prisma }
  }

  it('delegates searchGames to search engine with content limit', async () => {
    const { service, searchEngine } = createService()
    const query = { q: 'gal', page: 1, pageSize: 10 }

    const result = await service.searchGames(query as any, 2)

    expect(searchEngine.searchGames).toHaveBeenCalledWith(query, 2)
    expect(result).toEqual({ items: [], total: 0 })
  })

  it('queries Tag table for searchGameTags ordered by count', async () => {
    const tags = [
      { id: 1, name: 'galgame', count: 50 },
      { id: 2, name: 'otome', count: 20 },
    ]
    const prisma = { tag: { findMany: jest.fn().mockResolvedValue(tags) } }
    const { service } = createService({ prisma })

    const result = await service.searchGameTags({ q: 'gal', limit: 5 } as any)

    expect(prisma.tag.findMany).toHaveBeenCalledWith({
      where: { name: { contains: 'gal' } },
      orderBy: { count: 'desc' },
      take: 5,
      select: { id: true, name: true, count: true },
    })
    expect(result).toEqual(tags)
  })

  it('searchGameTags with empty query returns all tags', async () => {
    const prisma = { tag: { findMany: jest.fn().mockResolvedValue([]) } }
    const { service } = createService({ prisma })

    await service.searchGameTags({ q: '', limit: 10 } as any)

    expect(prisma.tag.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: undefined }))
  })
})
