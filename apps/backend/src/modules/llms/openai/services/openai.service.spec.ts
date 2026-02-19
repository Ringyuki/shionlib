jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn(),
}))

import OpenAI from 'openai'
import { ConfigService } from '@nestjs/config'
import { OpenaiService } from './openai.service'

describe('OpenaiService', () => {
  const OpenAIMock = OpenAI as unknown as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
  })

  function createService() {
    const parse = jest.fn().mockResolvedValue({ id: 'resp_1' })
    const create = jest.fn().mockResolvedValue({ id: 'mod_1' })
    OpenAIMock.mockImplementation(() => ({
      responses: { parse },
      moderations: { create },
    }))

    const config = {
      get: jest.fn((key: string) => {
        if (key === 'openai.apiKey') return 'sk-test'
        if (key === 'openai.baseURL') return 'https://api.openai.test/v1'
        return undefined
      }),
    } as unknown as ConfigService

    const service = new OpenaiService(config)

    return {
      service,
      parse,
      create,
    }
  }

  it('initializes openai client with config values', () => {
    createService()

    expect(OpenAIMock).toHaveBeenCalledWith({
      apiKey: 'sk-test',
      baseURL: 'https://api.openai.test/v1',
    })
  })

  it('parseResponse delegates to openai responses.parse', async () => {
    const { service, parse } = createService()

    const body = { model: 'gpt-4.1-mini', input: 'hello' } as any
    const result = await service.parseResponse(body)

    expect(parse).toHaveBeenCalledWith(body)
    expect(result).toEqual({ id: 'resp_1' })
  })

  it('moderate uses default model when not provided', async () => {
    const { service, create } = createService()

    const result = await service.moderate(undefined as any, 'hello')

    expect(create).toHaveBeenCalledWith({
      model: 'omni-moderation-latest',
      input: 'hello',
    })
    expect(result).toEqual({ id: 'mod_1' })
  })

  it('moderate accepts custom model and array input', async () => {
    const { service, create } = createService()

    await service.moderate('omni-moderation-latest' as any, ['a', 'b'])

    expect(create).toHaveBeenCalledWith({
      model: 'omni-moderation-latest',
      input: ['a', 'b'],
    })
  })
})
