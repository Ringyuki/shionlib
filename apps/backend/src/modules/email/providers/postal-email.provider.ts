import { Logger } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { firstValueFrom } from 'rxjs'
import { isArray } from 'class-validator'
import { EmailSender, SendEmailParams } from '../interfaces/email-sender.interface'

export class PostalEmailProvider implements EmailSender {
  private readonly logger = new Logger(PostalEmailProvider.name)

  constructor(
    private readonly httpService: HttpService,
    private readonly apiKey: string,
    private readonly endPoint: string,
    private readonly senderAddress: string,
    private readonly senderName: string,
  ) {}

  async send({ subject, to, bodyHtml, from }: SendEmailParams): Promise<boolean> {
    const emailData = {
      subject,
      from: `"${this.senderName}" <${from || this.senderAddress}>`,
      to: isArray(to) ? to : [to],
      html_body: bodyHtml,
    }

    try {
      const res = await firstValueFrom(
        this.httpService.post(this.endPoint, emailData, {
          family: 4,
          headers: {
            'X-Server-API-Key': this.apiKey,
          },
        }),
      )

      if (res.data.status !== 'success') {
        this.logger.error(`Failed to send email to ${to}:`, res.data)
        throw new Error(`Failed to send email to ${to}: ${res.data}`)
      }

      this.logger.log(`Email sent successfully to ${to}`)
      return true
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error)
      throw new Error('Failed to send email')
    }
  }
}
