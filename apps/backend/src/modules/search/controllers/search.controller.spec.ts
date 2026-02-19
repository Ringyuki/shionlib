import { SUGG_PREFIX_MIN_LENGTH, SEARCH_ANALYTICS_QUEUE } from '../constants/analytics'
import { SearchController } from './search.controller'

describe('SearchController', () => {
  const createController = () => {
    const searchService = {
      searchGames: jest.fn(),
      searchGameTags: jest.fn(),
    }
    const analyticsService = {
      getTrends: jest.fn(),
      getSuggestions: jest.fn(),
    }
    const analyticsQueue = {
      add: jest.fn(),
    }

    const controller = new SearchController(
      searchService as any,
      analyticsService as any,
      analyticsQueue as any,
    )

    return { controller, searchService, analyticsService, analyticsQueue }
  }

  it('searchGames enqueues analytics when query length is enough', async () => {
    const { controller, searchService, analyticsQueue } = createController()
    searchService.searchGames.mockResolvedValue({ items: [{ id: 1 }], total: 1 })

    const query = { q: 'a'.repeat(SUGG_PREFIX_MIN_LENGTH), page: 1, pageSize: 10 }
    const req = { user: { content_limit: 1 } }

    const result = await controller.searchGames(query as any, req as any)

    expect(analyticsQueue.add).toHaveBeenCalledWith(SEARCH_ANALYTICS_QUEUE, query.q)
    expect(searchService.searchGames).toHaveBeenCalledWith(query, 1)
    expect(result).toEqual({ items: [{ id: 1 }], total: 1 })
  })

  it('searchGames skips analytics queue for short query', async () => {
    const { controller, searchService, analyticsQueue } = createController()
    searchService.searchGames.mockResolvedValue({ items: [], total: 0 })

    const query = { page: 1, pageSize: 10 }
    await controller.searchGames(query as any, { user: { content_limit: 2 } } as any)

    expect(analyticsQueue.add).not.toHaveBeenCalled()
    expect(searchService.searchGames).toHaveBeenCalledWith(query, 2)
  })

  it('searchGameTags delegates to service', async () => {
    const { controller, searchService } = createController()
    searchService.searchGameTags.mockResolvedValue(['tag1'])

    const query = { q: 'romance', limit: 5 }
    const result = await controller.searchGameTags(query as any)

    expect(searchService.searchGameTags).toHaveBeenCalledWith(query)
    expect(result).toEqual(['tag1'])
  })

  it('getTrending passes window only when provided', async () => {
    const { controller, analyticsService } = createController()
    analyticsService.getTrends.mockResolvedValue(['a'])

    await controller.getTrending({ limit: 5 } as any)
    expect(analyticsService.getTrends).toHaveBeenNthCalledWith(1, 5, undefined)

    await controller.getTrending({ limit: 3, window: 60 } as any)
    expect(analyticsService.getTrends).toHaveBeenNthCalledWith(2, 3, [60])
  })

  it('getSuggestions delegates to analytics service', async () => {
    const { controller, analyticsService } = createController()
    analyticsService.getSuggestions.mockResolvedValue(['xy'])

    const result = await controller.getSuggestions({ prefix: 'x', limit: 8 } as any)

    expect(analyticsService.getSuggestions).toHaveBeenCalledWith('x', 8)
    expect(result).toEqual(['xy'])
  })
})
