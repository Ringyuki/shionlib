import { SearchService } from './search.service'

describe('SearchService', () => {
  it('delegates searchGames to search engine with content limit', async () => {
    const searchEngine = {
      searchGames: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      searchGameTags: jest.fn(),
    }
    const service = new SearchService(searchEngine as any)
    const query = { q: 'gal', page: 1, pageSize: 10 }

    const result = await service.searchGames(query as any, 2)

    expect(searchEngine.searchGames).toHaveBeenCalledWith(query, 2)
    expect(result).toEqual({ items: [], total: 0 })
  })

  it('delegates searchGameTags to search engine with dto fields', async () => {
    const searchEngine = {
      searchGames: jest.fn(),
      searchGameTags: jest.fn().mockResolvedValue(['tag-a', 'tag-b']),
    }
    const service = new SearchService(searchEngine as any)

    const result = await service.searchGameTags({ q: 'otome', limit: 5 } as any)

    expect(searchEngine.searchGameTags).toHaveBeenCalledWith('otome', 5)
    expect(result).toEqual(['tag-a', 'tag-b'])
  })
})
