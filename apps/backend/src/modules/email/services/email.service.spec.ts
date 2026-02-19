jest.mock('../templates', () => ({
  generatePasswordResetTemplate: jest.fn(() => '<password-reset-template>'),
  generateVerificationCodeTemplate: jest.fn(() => '<verification-template>'),
  generateReportNotificationTemplate: jest.fn(() => '<report-template>'),
  generateMalwareScanNotificationTemplate: jest.fn(() => '<malware-template>'),
}))

import { of, throwError } from 'rxjs'
import {
  generatePasswordResetTemplate,
  generateVerificationCodeTemplate,
  generateReportNotificationTemplate,
  generateMalwareScanNotificationTemplate,
} from '../templates'
import { EmailService } from './email.service'

describe('EmailService', () => {
  const generatePasswordResetTemplateMock = generatePasswordResetTemplate as unknown as jest.Mock
  const generateVerificationCodeTemplateMock =
    generateVerificationCodeTemplate as unknown as jest.Mock
  const generateReportNotificationTemplateMock =
    generateReportNotificationTemplate as unknown as jest.Mock
  const generateMalwareScanNotificationTemplateMock =
    generateMalwareScanNotificationTemplate as unknown as jest.Mock

  const createService = (provider: 'elastic' | 'postal' | 'unknown' = 'elastic') => {
    const configValues = new Map<string, any>([
      ['email.emailProvider', provider],
      ['email.emailApiKey', 'api-key'],
      ['email.emailEndPoint', 'https://email.endpoint/send'],
      ['email.emailSenderAddress', 'noreply@example.com'],
      ['email.emailSenderName', 'Shionlib'],
    ])
    const configService = {
      get: jest.fn((key: string) => configValues.get(key)),
    }
    const httpService = {
      post: jest.fn(),
    }
    const i18nService = {
      t: jest.fn((key: string) => `i18n:${key}`),
    }

    const service = new EmailService(configService as any, httpService as any, i18nService as any)

    return { configService, httpService, i18nService, service }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('sendEmail sends through elastic provider and supports custom from address', async () => {
    const { service, httpService } = createService('elastic')
    const logSpy = jest.spyOn((service as any).logger, 'log').mockImplementation(() => {})

    httpService.post.mockReturnValueOnce(of({ data: { ok: true } }))

    await expect(
      service.sendEmail({
        subject: 'hello',
        to: 'user@example.com',
        bodyHtml: '<p>x</p>',
        from: 'custom@example.com',
      } as any),
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

  it('sendEmail handles elastic provider failures', async () => {
    const { service, httpService } = createService('elastic')
    const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation(() => {})
    httpService.post.mockReturnValueOnce(throwError(() => new Error('elastic failed')))

    await expect(
      service.sendEmail({
        subject: 'hello',
        to: 'user@example.com',
        bodyHtml: '<p>x</p>',
      } as any),
    ).rejects.toThrow('Failed to send email')
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to send email to user@example.com:',
      expect.any(Error),
    )
    errorSpy.mockRestore()
  })

  it('sendEmail sends through postal provider and normalizes recipient list', async () => {
    const { service, httpService } = createService('postal')
    const logSpy = jest.spyOn((service as any).logger, 'log').mockImplementation(() => {})

    httpService.post.mockReturnValueOnce(
      of({
        data: { status: 'success' },
      }),
    )

    await expect(
      service.sendEmail({
        subject: 'hello',
        to: 'user@example.com',
        bodyHtml: '<p>x</p>',
      } as any),
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

  it('sendEmail throws for postal non-success status and request errors', async () => {
    const { service, httpService } = createService('postal')
    const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation(() => {})

    httpService.post.mockReturnValueOnce(
      of({
        data: { status: 'failed', reason: 'quota' },
      }),
    )
    await expect(
      service.sendEmail({
        subject: 'hello',
        to: ['a@example.com', 'b@example.com'],
        bodyHtml: '<p>x</p>',
      } as any),
    ).rejects.toThrow('Failed to send email')

    httpService.post.mockReturnValueOnce(throwError(() => new Error('postal down')))
    await expect(
      service.sendEmail({
        subject: 'hello',
        to: 'user@example.com',
        bodyHtml: '<p>x</p>',
      } as any),
    ).rejects.toThrow('Failed to send email')

    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('sendEmail returns false for unsupported provider', async () => {
    const { service } = createService('unknown')

    await expect(
      service.sendEmail({
        subject: 'hello',
        to: 'user@example.com',
        bodyHtml: '<p>x</p>',
      } as any),
    ).resolves.toBe(false)
  })

  it('business wrappers build payload with i18n/template and delegate to sendEmail', async () => {
    const { service, i18nService } = createService('elastic')
    const sendEmailSpy = jest.spyOn(service, 'sendEmail').mockResolvedValue(true)
    const reportData = { reportId: 1 } as any
    const malwareData = { caseId: 2 } as any

    await expect(service.sendVerificationCode('a@example.com', '123456', 300)).resolves.toBe(true)
    expect(i18nService.t).toHaveBeenCalledWith('message.email.VERIFICATION_CODE_SUBJECT')
    expect(generateVerificationCodeTemplateMock).toHaveBeenCalledWith(i18nService, '123456', 300)
    expect(sendEmailSpy).toHaveBeenCalledWith({
      subject: 'i18n:message.email.VERIFICATION_CODE_SUBJECT',
      to: 'a@example.com',
      bodyHtml: '<verification-template>',
    })

    await expect(
      service.sendPasswordResetLink('a@example.com', 'https://reset.example.com', 600),
    ).resolves.toBe(true)
    expect(i18nService.t).toHaveBeenCalledWith('message.email.PASSWORD_RESET_SUBJECT')
    expect(generatePasswordResetTemplateMock).toHaveBeenCalledWith(
      i18nService,
      'https://reset.example.com',
      600,
    )

    await expect(service.sendReportNotification(['a@example.com'], reportData)).resolves.toBe(true)
    expect(i18nService.t).toHaveBeenCalledWith('message.email.REPORT_NOTIFICATION_SUBJECT')
    expect(generateReportNotificationTemplateMock).toHaveBeenCalledWith(i18nService, reportData)

    await expect(service.sendMalwareScanNotification('a@example.com', malwareData)).resolves.toBe(
      true,
    )
    expect(i18nService.t).toHaveBeenCalledWith('message.email.MALWARE_SCAN_NOTIFICATION_SUBJECT')
    expect(generateMalwareScanNotificationTemplateMock).toHaveBeenCalledWith(
      i18nService,
      malwareData,
    )
  })
})
