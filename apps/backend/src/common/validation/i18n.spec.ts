import { i18nValidationMessage } from 'nestjs-i18n'
import { ivm, ivmEnum } from './i18n'

jest.mock('nestjs-i18n', () => ({
  i18nValidationMessage: jest.fn((key: string, args?: Record<string, any>) => ({ key, args })),
}))

describe('i18n validation helpers', () => {
  beforeEach(() => {
    ;(i18nValidationMessage as jest.Mock).mockClear()
  })

  it('ivm passes key and args to i18nValidationMessage', () => {
    const result = ivm('validation.required' as any, { field: 'name' })

    expect(i18nValidationMessage).toHaveBeenCalledWith('validation.required', { field: 'name' })
    expect(result).toEqual({ key: 'validation.required', args: { field: 'name' } })
  })

  it('ivmEnum injects string enum values into allowed list', () => {
    enum DemoEnum {
      A = 'A',
      B = 'B',
    }

    const result = ivmEnum('validation.enum' as any, DemoEnum, { field: 'role' })

    expect(i18nValidationMessage).toHaveBeenCalledWith('validation.enum', {
      allowed: expect.stringContaining('A'),
      field: 'role',
    })
    expect(result).toEqual({
      key: 'validation.enum',
      args: expect.objectContaining({ allowed: expect.any(String), field: 'role' }),
    })
  })
})
