import { formattingValidationMessage } from './formatting-validation-message.utl'

describe('formattingValidationMessage', () => {
  it('returns plain string directly when no args separator is present', () => {
    const i18n = { t: jest.fn() } as any

    expect(formattingValidationMessage('raw message', i18n, 'en')).toBe('raw message')
    expect(i18n.t).not.toHaveBeenCalled()
  })

  it('parses i18n args payload and forwards to i18n.t', () => {
    const i18n = { t: jest.fn().mockReturnValue('translated') } as any

    const result = formattingValidationMessage(
      'validation.user.EMAIL_INVALID|{"email":"a@example.com"}',
      i18n,
      'en',
    )

    expect(result).toBe('translated')
    expect(i18n.t).toHaveBeenCalledWith('validation.user.EMAIL_INVALID', {
      lang: 'en',
      args: { email: 'a@example.com' },
    })
  })

  it('falls back to empty args on invalid json payload', () => {
    const i18n = { t: jest.fn().mockReturnValue('translated') } as any

    formattingValidationMessage('validation.user.EMAIL_INVALID|{', i18n, 'zh')

    expect(i18n.t).toHaveBeenCalledWith('validation.user.EMAIL_INVALID', {
      lang: 'zh',
      args: {},
    })
  })
})
