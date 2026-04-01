import { Inject, Injectable } from '@nestjs/common'
import { I18nService } from 'nestjs-i18n'
import { EMAIL_SENDER, EmailSender } from '../interfaces/email-sender.interface'
import { ReportNotificationData, MalwareScanNotificationData } from '../interfaces/email.interface'
import {
  generatePasswordResetTemplate,
  generateVerificationCodeTemplate,
  generateReportNotificationTemplate,
  generateMalwareScanNotificationTemplate,
} from '../templates'

@Injectable()
export class EmailService {
  constructor(
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSender,
    private readonly i18nService: I18nService,
  ) {}

  async sendVerificationCode(email: string, code: string, expSeconds?: number): Promise<boolean> {
    return this.emailSender.send({
      subject: this.i18nService.t('message.email.VERIFICATION_CODE_SUBJECT'),
      to: email,
      bodyHtml: generateVerificationCodeTemplate(this.i18nService, code, expSeconds),
    })
  }

  async sendPasswordResetLink(
    email: string,
    resetLink: string,
    expSeconds = 600,
  ): Promise<boolean> {
    return this.emailSender.send({
      subject: this.i18nService.t('message.email.PASSWORD_RESET_SUBJECT'),
      to: email,
      bodyHtml: generatePasswordResetTemplate(this.i18nService, resetLink, expSeconds),
    })
  }

  async sendReportNotification(
    emails: string | string[],
    data: ReportNotificationData,
  ): Promise<boolean> {
    return this.emailSender.send({
      subject: this.i18nService.t('message.email.REPORT_NOTIFICATION_SUBJECT'),
      to: emails,
      bodyHtml: generateReportNotificationTemplate(this.i18nService, data),
    })
  }

  async sendMalwareScanNotification(
    emails: string | string[],
    data: MalwareScanNotificationData,
  ): Promise<boolean> {
    return this.emailSender.send({
      subject: this.i18nService.t('message.email.MALWARE_SCAN_NOTIFICATION_SUBJECT'),
      to: emails,
      bodyHtml: generateMalwareScanNotificationTemplate(this.i18nService, data),
    })
  }
}
