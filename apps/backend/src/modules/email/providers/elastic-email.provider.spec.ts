import { of, throwError } from 'rxjs'
import { ElasticEmailProvider } from './elastic-email.provider'

describe('ElasticEmailProvider', () => {
  const createProvider = () => {
    const httpService = { post: jest.fn() }
    const provider = new ElasticEmailProvider(
      httpService as any,
      'api-key',
      'https://email.endpoint/send',
      'noreply@example.com',
      'Shionlib',
    )
    return { httpService, provider }
  }

  it('sends email through elastic API and supports custom from address', async () => {
    const { provider, httpService } = createProvider()
    const logSpy = jest.spyOn((provider as any).logger, 'log').mockImplementation(() => {})

    httpService.post.mockReturnValueOnce(of({ data: { ok: true } }))

    await expect(
      provider.send({
        subject: 'hello',
        to: 'user@example.com',
        bodyHtml: '<p>x</p>',
        from: 'custom@example.com',
      }),
    ).resolves.toBe(true)

    expect(httpService.post).toHaveBeenCalledWith('https://email.endpoint/send', null, {
      family: 4,
      params: {
        apikey: 'api-key',
        subject: 'hello',
        from: 'custom@example.com',
        fromName: 'Shionlib',
        senderName: 'Shionlib',
        to: 'user@example.com',
        bodyHtml: '<p>x</p>',
        isTransactional: true,
      },
    })
    expect(logSpy).toHaveBeenCalledWith('Email sent successfully to user@example.com')
    logSpy.mockRestore()
  })

  it('uses default sender address when from is not provided', async () => {
    const { provider, httpService } = createProvider()
    jest.spyOn((provider as any).logger, 'log').mockImplementation(() => {})

    httpService.post.mockReturnValueOnce(of({ data: { ok: true } }))

    await provider.send({
      subject: 'hello',
      to: 'user@example.com',
      bodyHtml: '<p>x</p>',
    })

    expect(httpService.post).toHaveBeenCalledWith(
      'https://email.endpoint/send',
      null,
      expect.objectContaining({
        params: expect.objectContaining({ from: 'noreply@example.com' }),
      }),
    )
  })

  it('throws on failure', async () => {
    const { provider, httpService } = createProvider()
    const errorSpy = jest.spyOn((provider as any).logger, 'error').mockImplementation(() => {})

    httpService.post.mockReturnValueOnce(throwError(() => new Error('elastic failed')))

    await expect(
      provider.send({
        subject: 'hello',
        to: 'user@example.com',
        bodyHtml: '<p>x</p>',
      }),
    ).rejects.toThrow('Failed to send email')

    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to send email to user@example.com:',
      expect.any(Error),
    )
    errorSpy.mockRestore()
  })
})
