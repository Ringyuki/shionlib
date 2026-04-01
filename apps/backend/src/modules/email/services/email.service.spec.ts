jest.mock('../templates', () => ({
  generatePasswordResetTemplate: jest.fn(() => '<password-reset-template>'),
  generateVerificationCodeTemplate: jest.fn(() => '<verification-template>'),
  generateReportNotificationTemplate: jest.fn(() => '<report-template>'),
  generateMalwareScanNotificationTemplate: jest.fn(() => '<malware-template>'),
}))

import {
  generatePasswordResetTemplate,
  generateVerificationCodeTemplate,
  generateReportNotificationTemplate,
  generateMalwareScanNotificationTemplate,
} from '../templates'
import { EmailService } from './email.service'
import { EmailSender } from '../interfaces/email-sender.interface'

describe('EmailService', () => {
  const generatePasswordResetTemplateMock = generatePasswordResetTemplate as unknown as jest.Mock
  const generateVerificationCodeTemplateMock =
    generateVerificationCodeTemplate as unknown as jest.Mock
  const generateReportNotificationTemplateMock =
    generateReportNotificationTemplate as unknown as jest.Mock
  const generateMalwareScanNotificationTemplateMock =
    generateMalwareScanNotificationTemplate as unknown as jest.Mock

  const createService = () => {
    const emailSender: jest.Mocked<EmailSender> = {
      send: jest.fn().mockResolvedValue(true),
    }
    const i18nService = {
      t: jest.fn((key: string) => `i18n:${key}`),
    }

    const service = new EmailService(emailSender, i18nService as any)

    return { emailSender, i18nService, service }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('sendVerificationCode builds payload with i18n/template and delegates to emailSender', async () => {
    const { service, emailSender, i18nService } = createService()

    await expect(service.sendVerificationCode('a@example.com', '123456', 300)).resolves.toBe(true)
    expect(i18nService.t).toHaveBeenCalledWith('message.email.VERIFICATION_CODE_SUBJECT')
    expect(generateVerificationCodeTemplateMock).toHaveBeenCalledWith(i18nService, '123456', 300)
    expect(emailSender.send).toHaveBeenCalledWith({
      subject: 'i18n:message.email.VERIFICATION_CODE_SUBJECT',
      to: 'a@example.com',
      bodyHtml: '<verification-template>',
    })
  })

  it('sendPasswordResetLink builds payload with i18n/template and delegates to emailSender', async () => {
    const { service, emailSender, i18nService } = createService()

    await expect(
      service.sendPasswordResetLink('a@example.com', 'https://reset.example.com', 600),
    ).resolves.toBe(true)
    expect(i18nService.t).toHaveBeenCalledWith('message.email.PASSWORD_RESET_SUBJECT')
    expect(generatePasswordResetTemplateMock).toHaveBeenCalledWith(
      i18nService,
      'https://reset.example.com',
      600,
    )
    expect(emailSender.send).toHaveBeenCalledWith({
      subject: 'i18n:message.email.PASSWORD_RESET_SUBJECT',
      to: 'a@example.com',
      bodyHtml: '<password-reset-template>',
    })
  })

  it('sendReportNotification builds payload with i18n/template and delegates to emailSender', async () => {
    const { service, emailSender, i18nService } = createService()
    const reportData = { reportId: 1 } as any

    await expect(service.sendReportNotification(['a@example.com'], reportData)).resolves.toBe(true)
    expect(i18nService.t).toHaveBeenCalledWith('message.email.REPORT_NOTIFICATION_SUBJECT')
    expect(generateReportNotificationTemplateMock).toHaveBeenCalledWith(i18nService, reportData)
    expect(emailSender.send).toHaveBeenCalledWith({
      subject: 'i18n:message.email.REPORT_NOTIFICATION_SUBJECT',
      to: ['a@example.com'],
      bodyHtml: '<report-template>',
    })
  })

  it('sendMalwareScanNotification builds payload with i18n/template and delegates to emailSender', async () => {
    const { service, emailSender, i18nService } = createService()
    const malwareData = { caseId: 2 } as any

    await expect(service.sendMalwareScanNotification('a@example.com', malwareData)).resolves.toBe(
      true,
    )
    expect(i18nService.t).toHaveBeenCalledWith('message.email.MALWARE_SCAN_NOTIFICATION_SUBJECT')
    expect(generateMalwareScanNotificationTemplateMock).toHaveBeenCalledWith(
      i18nService,
      malwareData,
    )
    expect(emailSender.send).toHaveBeenCalledWith({
      subject: 'i18n:message.email.MALWARE_SCAN_NOTIFICATION_SUBJECT',
      to: 'a@example.com',
      bodyHtml: '<malware-template>',
    })
  })

  it('propagates errors from emailSender', async () => {
    const { service, emailSender } = createService()
    emailSender.send.mockRejectedValueOnce(new Error('Failed to send email'))

    await expect(service.sendVerificationCode('a@example.com', '123456')).rejects.toThrow(
      'Failed to send email',
    )
  })
})
