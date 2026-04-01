import { HttpService } from '@nestjs/axios'
import { emailSenderFactory } from './email.module'
import { ElasticEmailProvider } from './providers/elastic-email.provider'
import { PostalEmailProvider } from './providers/postal-email.provider'

describe('emailSenderFactory', () => {
  const httpService = {} as HttpService

  const createConfigService = (provider: string) =>
    ({
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          'email.emailProvider': provider,
          'email.emailApiKey': 'key',
          'email.emailEndPoint': 'https://endpoint',
          'email.emailSenderAddress': 'noreply@example.com',
          'email.emailSenderName': 'Shionlib',
        }
        return values[key]
      }),
    }) as any

  it('creates ElasticEmailProvider for elastic config', () => {
    const result = emailSenderFactory(httpService, createConfigService('elastic'))
    expect(result).toBeInstanceOf(ElasticEmailProvider)
  })

  it('creates PostalEmailProvider for postal config', () => {
    const result = emailSenderFactory(httpService, createConfigService('postal'))
    expect(result).toBeInstanceOf(PostalEmailProvider)
  })

  it('throws for unsupported provider', () => {
    expect(() => emailSenderFactory(httpService, createConfigService('unknown'))).toThrow(
      'Unsupported email provider: unknown',
    )
  })
})
