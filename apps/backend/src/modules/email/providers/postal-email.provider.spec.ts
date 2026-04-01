import { of, throwError } from 'rxjs'
import { PostalEmailProvider } from './postal-email.provider'

describe('PostalEmailProvider', () => {
  const createProvider = () => {
    const httpService = { post: jest.fn() }
    const provider = new PostalEmailProvider(
      httpService as any,
      'api-key',
      'https://email.endpoint/send',
      'noreply@example.com',
      'Shionlib',
    )
    return { httpService, provider }
  }

  it('sends email through postal API and normalizes recipient list', async () => {
    const { provider, httpService } = createProvider()
    const logSpy = jest.spyOn((provider as any).logger, 'log').mockImplementation(() => {})

    httpService.post.mockReturnValueOnce(of({ data: { status: 'success' } }))

    await expect(
      provider.send({
        subject: 'hello',
        to: 'user@example.com',
        bodyHtml: '<p>x</p>',
      }),
    ).resolves.toBe(true)

    expect(httpService.post).toHaveBeenCalledWith(
      'https://email.endpoint/send',
      {
        subject: 'hello',
        from: '"Shionlib" <noreply@example.com>',
        to: ['user@example.com'],
        html_body: '<p>x</p>',
      },
      {
        family: 4,
        headers: {
          'X-Server-API-Key': 'api-key',
        },
      },
    )
    expect(logSpy).toHaveBeenCalledWith('Email sent successfully to user@example.com')
    logSpy.mockRestore()
  })

  it('passes array recipients as-is', async () => {
    const { provider, httpService } = createProvider()
    jest.spyOn((provider as any).logger, 'log').mockImplementation(() => {})

    httpService.post.mockReturnValueOnce(of({ data: { status: 'success' } }))

    await provider.send({
      subject: 'hello',
      to: ['a@example.com', 'b@example.com'],
      bodyHtml: '<p>x</p>',
    })

    expect(httpService.post).toHaveBeenCalledWith(
      'https://email.endpoint/send',
      expect.objectContaining({ to: ['a@example.com', 'b@example.com'] }),
      expect.any(Object),
    )
  })

  it('throws for non-success status', async () => {
    const { provider, httpService } = createProvider()
    const errorSpy = jest.spyOn((provider as any).logger, 'error').mockImplementation(() => {})

    httpService.post.mockReturnValueOnce(of({ data: { status: 'failed', reason: 'quota' } }))

    await expect(
      provider.send({
        subject: 'hello',
        to: ['a@example.com', 'b@example.com'],
        bodyHtml: '<p>x</p>',
      }),
    ).rejects.toThrow('Failed to send email')

    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('throws on request error', async () => {
    const { provider, httpService } = createProvider()
    const errorSpy = jest.spyOn((provider as any).logger, 'error').mockImplementation(() => {})

    httpService.post.mockReturnValueOnce(throwError(() => new Error('postal down')))

    await expect(
      provider.send({
        subject: 'hello',
        to: 'user@example.com',
        bodyHtml: '<p>x</p>',
      }),
    ).rejects.toThrow('Failed to send email')

    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})
