import { ConfigService } from '@nestjs/config'
import { ShionConfigService } from './config.service'

describe('ShionConfigService', () => {
  it('delegates get to nest config service', () => {
    const configService = {
      get: jest.fn().mockReturnValue('secret-value'),
    }
    const service = new ShionConfigService(configService as unknown as ConfigService)

    const result = service.get('token.secret' as any)

    expect(configService.get).toHaveBeenCalledWith('token.secret')
    expect(result).toBe('secret-value')
  })
})
