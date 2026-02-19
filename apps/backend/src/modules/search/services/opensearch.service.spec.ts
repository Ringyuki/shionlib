jest.mock('@opensearch-project/opensearch', () => ({
  __esModule: true,
  Client: jest.fn(),
}))

jest.mock('fs', () => ({
  __esModule: true,
  default: {
    readFileSync: jest.fn(),
  },
}))

import { Client } from '@opensearch-project/opensearch'
import fs from 'fs'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { OpenSearchService } from './opensearch.service'

describe('OpenSearchService', () => {
  const ClientMock = Client as unknown as jest.Mock
  const readFileSyncMock = fs.readFileSync as unknown as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
  })

  function createConfig(values: Record<string, any>) {
    return {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ShionConfigService
  }

  it('skips init when engine is not opensearch', () => {
    const service = new OpenSearchService(createConfig({ 'search.engine': 'meilisearch' }))

    service.onModuleInit()

    expect(ClientMock).not.toHaveBeenCalled()
  })

  it('warns and skips init when required config is missing', () => {
    const service = new OpenSearchService(
      createConfig({
        'search.engine': 'opensearch',
        'search.opensearch.host': '',
        'search.opensearch.protocol': 'https',
        'search.opensearch.port': 9200,
        'search.opensearch.caPath': '/tmp/ca.crt',
      }),
    )
    const warnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation()

    service.onModuleInit()

    expect(warnSpy).toHaveBeenCalledWith('OpenSearch host/protocol/port/caPath is not set')
    expect(ClientMock).not.toHaveBeenCalled()
  })

  it('initializes client with auth and ssl ca', () => {
    const ca = Buffer.from('ca-content')
    readFileSyncMock.mockReturnValue(ca)
    const client = { indices: { refresh: jest.fn() } }
    ClientMock.mockImplementation(() => client)

    const service = new OpenSearchService(
      createConfig({
        'search.engine': 'opensearch',
        'search.opensearch.host': 'localhost',
        'search.opensearch.protocol': 'https',
        'search.opensearch.port': 9200,
        'search.opensearch.auth': 'user:pass',
        'search.opensearch.caPath': '/tmp/ca.crt',
      }),
    )
    const logSpy = jest.spyOn((service as any).logger, 'log').mockImplementation()

    service.onModuleInit()

    expect(readFileSyncMock).toHaveBeenCalledWith('/tmp/ca.crt')
    expect(ClientMock).toHaveBeenCalledWith({
      node: 'https://user:pass@localhost:9200',
      ssl: { ca },
    })
    expect(logSpy).toHaveBeenCalledWith('OpenSearch client initialized successfully')
    expect(service.getClient()).toBe(client)
  })

  it('initializes client without auth', () => {
    readFileSyncMock.mockReturnValue(Buffer.from('ca-content'))
    ClientMock.mockImplementation(() => ({ indices: { refresh: jest.fn() } }))

    const service = new OpenSearchService(
      createConfig({
        'search.engine': 'opensearch',
        'search.opensearch.host': 'localhost',
        'search.opensearch.protocol': 'http',
        'search.opensearch.port': 9200,
        'search.opensearch.auth': '',
        'search.opensearch.caPath': '/tmp/ca.crt',
      }),
    )

    service.onModuleInit()

    expect(ClientMock).toHaveBeenCalledWith({
      node: 'http://localhost:9200',
      ssl: { ca: expect.any(Buffer) },
    })
  })

  it('logs and rethrows when init fails', () => {
    const initError = new Error('init fail')
    readFileSyncMock.mockReturnValue(Buffer.from('ca-content'))
    ClientMock.mockImplementation(() => {
      throw initError
    })

    const service = new OpenSearchService(
      createConfig({
        'search.engine': 'opensearch',
        'search.opensearch.host': 'localhost',
        'search.opensearch.protocol': 'https',
        'search.opensearch.port': 9200,
        'search.opensearch.auth': '',
        'search.opensearch.caPath': '/tmp/ca.crt',
      }),
    )
    const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation()

    expect(() => service.onModuleInit()).toThrow('init fail')
    expect(errorSpy).toHaveBeenCalledWith('Failed to initialize OpenSearch client', initError)
  })

  it('refresh returns when client not ready', async () => {
    const service = new OpenSearchService(createConfig({ 'search.engine': 'opensearch' }))

    await expect(service.refresh('games')).resolves.toBeUndefined()
  })

  it('refresh delegates to indices.refresh', async () => {
    const refresh = jest.fn().mockResolvedValue(undefined)
    const service = new OpenSearchService(createConfig({ 'search.engine': 'opensearch' }))
    ;(service as any).client = {
      indices: { refresh },
    }

    await service.refresh('games')

    expect(refresh).toHaveBeenCalledWith({ index: 'games' })
  })

  it('ensureIndex returns when client not ready', async () => {
    const service = new OpenSearchService(createConfig({ 'search.engine': 'opensearch' }))

    await expect(service.ensureIndex('games')).resolves.toBeUndefined()
  })

  it('ensureIndex no-op when index already exists', async () => {
    const exists = jest.fn().mockResolvedValue({ body: true })
    const create = jest.fn()
    const service = new OpenSearchService(createConfig({ 'search.engine': 'opensearch' }))
    ;(service as any).client = {
      indices: { exists, create },
    }

    await service.ensureIndex('games')

    expect(exists).toHaveBeenCalledWith({ index: 'games' })
    expect(create).not.toHaveBeenCalled()
  })

  it('creates index when missing and createIfNotExists is true', async () => {
    const exists = jest.fn().mockResolvedValue({ body: false })
    const create = jest.fn().mockResolvedValue(undefined)
    const service = new OpenSearchService(createConfig({ 'search.engine': 'opensearch' }))
    ;(service as any).client = {
      indices: { exists, create },
    }
    const logSpy = jest.spyOn((service as any).logger, 'log').mockImplementation()

    await service.ensureIndex('games', true)

    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0][0]).toMatchObject({ index: 'games' })
    expect(logSpy).toHaveBeenCalledWith('Index games created with mappings/settings')
  })

  it('throws friendly error when index is missing and createIfNotExists is false', async () => {
    const exists = jest.fn().mockResolvedValue({ body: false })
    const service = new OpenSearchService(createConfig({ 'search.engine': 'opensearch' }))
    ;(service as any).client = {
      indices: { exists },
    }
    const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation()

    await expect(service.ensureIndex('games', false)).rejects.toThrow(
      'Index games not found, run pnpm reindex:all first',
    )
    expect(errorSpy).toHaveBeenCalledWith('Index games not found, run pnpm reindex:all first')
  })

  it('logs and rethrows when create index fails', async () => {
    const exists = jest.fn().mockResolvedValue({ body: false })
    const createError = new Error('create failed')
    const create = jest.fn().mockRejectedValue(createError)
    const service = new OpenSearchService(createConfig({ 'search.engine': 'opensearch' }))
    ;(service as any).client = {
      indices: { exists, create },
    }
    const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation()

    await expect(service.ensureIndex('games', true)).rejects.toThrow('create failed')
    expect(errorSpy).toHaveBeenCalledWith('Failed to create index', createError)
  })
})
