jest.mock('meilisearch', () => {
  class MockMeiliSearchApiError extends Error {
    response: { status: number }

    constructor(status: number, message = 'api error') {
      super(message)
      this.response = { status }
    }
  }

  return {
    __esModule: true,
    MeiliSearch: jest.fn(),
    MeiliSearchApiError: MockMeiliSearchApiError,
  }
})

import { MeiliSearch, MeiliSearchApiError } from 'meilisearch'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { MeilisearchService } from './meilisearch.service'

describe('MeilisearchService', () => {
  const MeiliSearchMock = MeiliSearch as unknown as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
  })

  function createConfig(values: Record<string, any>) {
    return {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ShionConfigService
  }

  it('skips init when engine is not meilisearch', async () => {
    const config = createConfig({ 'search.engine': 'opensearch' })
    const service = new MeilisearchService(config)

    await service.onModuleInit()

    expect(MeiliSearchMock).not.toHaveBeenCalled()
    expect(service.getClient()).toBeNull()
  })

  it('warns and skips init when host or apiKey is missing', async () => {
    const config = createConfig({
      'search.engine': 'meilisearch',
      'search.meilisearch.host': '',
      'search.meilisearch.apiKey': '',
    })
    const service = new MeilisearchService(config)
    const warnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation()

    await service.onModuleInit()

    expect(warnSpy).toHaveBeenCalledWith('Meilisearch host or api key is not set')
    expect(MeiliSearchMock).not.toHaveBeenCalled()
    expect(service.getClient()).toBeNull()
  })

  it('initializes client successfully', async () => {
    const client = { getIndex: jest.fn() }
    MeiliSearchMock.mockImplementation(() => client)

    const config = createConfig({
      'search.engine': 'meilisearch',
      'search.meilisearch.host': 'http://127.0.0.1:7700',
      'search.meilisearch.apiKey': 'key',
    })
    const service = new MeilisearchService(config)
    const logSpy = jest.spyOn((service as any).logger, 'log').mockImplementation()

    await service.onModuleInit()

    expect(MeiliSearchMock).toHaveBeenCalledWith({
      host: 'http://127.0.0.1:7700',
      apiKey: 'key',
    })
    expect(logSpy).toHaveBeenCalledWith('Meilisearch client initialized successfully')
    expect(service.getClient()).toBe(client)
  })

  it('logs and rethrows when init fails', async () => {
    const initError = new Error('boom')
    MeiliSearchMock.mockImplementation(() => {
      throw initError
    })

    const config = createConfig({
      'search.engine': 'meilisearch',
      'search.meilisearch.host': 'http://127.0.0.1:7700',
      'search.meilisearch.apiKey': 'key',
    })
    const service = new MeilisearchService(config)
    const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation()

    await expect(service.onModuleInit()).rejects.toThrow('boom')
    expect(errorSpy).toHaveBeenCalledWith('Failed to initialize Meilisearch client', initError)
  })

  it('returns existing index in ensureIndex', async () => {
    const index = { updateSettings: jest.fn() }
    const client = {
      getIndex: jest.fn().mockResolvedValue(index),
    }

    const service = new MeilisearchService(createConfig({ 'search.engine': 'meilisearch' }))
    ;(service as any).client = client

    await expect(service.ensureIndex('games')).resolves.toBe(index)
    expect(client.getIndex).toHaveBeenCalledWith('games')
  })

  it('creates index when not found and createIfNotExists is true', async () => {
    const index = { updateSettings: jest.fn().mockResolvedValue(undefined) }
    const notFound = new (MeiliSearchApiError as any)(404, 'not found')
    const client = {
      getIndex: jest.fn().mockRejectedValueOnce(notFound).mockResolvedValueOnce(index),
      deleteIndex: jest.fn().mockResolvedValue(undefined),
      createIndex: jest.fn().mockResolvedValue(undefined),
      index: jest.fn().mockReturnValue(index),
    }

    const service = new MeilisearchService(createConfig({ 'search.engine': 'meilisearch' }))
    ;(service as any).client = client

    await expect(service.ensureIndex('games', true)).resolves.toBe(index)
    expect(client.deleteIndex).toHaveBeenCalledWith('games')
    expect(client.createIndex).toHaveBeenCalledWith('games', { primaryKey: 'id' })
    expect(index.updateSettings).toHaveBeenCalledTimes(1)
    expect(client.getIndex).toHaveBeenCalledTimes(2)
  })

  it('throws friendly error when index is missing and createIfNotExists is false', async () => {
    const notFound = new (MeiliSearchApiError as any)(404, 'not found')
    const client = {
      getIndex: jest.fn().mockRejectedValue(notFound),
    }

    const service = new MeilisearchService(createConfig({ 'search.engine': 'meilisearch' }))
    ;(service as any).client = client
    const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation()

    await expect(service.ensureIndex('games', false)).rejects.toThrow(
      'Index games not found, run pnpm reindex:all first',
    )
    expect(errorSpy).toHaveBeenCalledWith('Index games not found, run pnpm reindex:all first')
  })

  it('rethrows non-404 errors in ensureIndex', async () => {
    const failure = new Error('network')
    const client = {
      getIndex: jest.fn().mockRejectedValue(failure),
    }

    const service = new MeilisearchService(createConfig({ 'search.engine': 'meilisearch' }))
    ;(service as any).client = client

    await expect(service.ensureIndex('games')).rejects.toThrow('network')
  })
})
