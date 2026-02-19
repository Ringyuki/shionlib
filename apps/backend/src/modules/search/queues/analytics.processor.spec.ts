import { SearchAnalyticsProcessor } from './analytics.processor'

describe('SearchAnalyticsProcessor', () => {
  it('records search keyword from job payload', async () => {
    const analytics = {
      recordSearch: jest.fn().mockResolvedValue(undefined),
    }
    const processor = new SearchAnalyticsProcessor(analytics as any)

    await processor.handle({ data: 'visual novel' } as any)

    expect(analytics.recordSearch).toHaveBeenCalledWith('visual novel')
  })

  it('logs and rethrows when analytics record fails', async () => {
    const error = new Error('redis unavailable')
    const analytics = {
      recordSearch: jest.fn().mockRejectedValue(error),
    }
    const processor = new SearchAnalyticsProcessor(analytics as any)
    const logger = { error: jest.fn() }
    ;(processor as any).logger = logger

    await expect(processor.handle({ data: 'test' } as any)).rejects.toThrow('redis unavailable')
    expect(logger.error).toHaveBeenCalledWith('Failed processing search analytics job', error.stack)
  })
})
