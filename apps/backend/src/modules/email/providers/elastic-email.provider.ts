import { Logger } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { firstValueFrom } from 'rxjs'
import { EmailSender, SendEmailParams } from '../interfaces/email-sender.interface'

export class ElasticEmailProvider implements EmailSender {
  private readonly logger = new Logger(ElasticEmailProvider.name)

  constructor(
    private readonly httpService: HttpService,
    private readonly apiKey: string,
    private readonly endPoint: string,
    private readonly senderAddress: string,
    private readonly senderName: string,
  ) {}

  async send({ subject, to, bodyHtml, from }: SendEmailParams): Promise<boolean> {
    const emailData = {
      apikey: this.apiKey,
      subject,
      from: from || this.senderAddress,
      fromName: this.senderName,
      senderName: this.senderName,
      to,
      bodyHtml,
      isTransactional: true,
    }

    try {
      await firstValueFrom(
        this.httpService.post(this.endPoint, null, {
          family: 4,
          params: emailData,
        }),
      )

      this.logger.log(`Email sent successfully to ${to}`)
      return true
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error)
      throw new Error('Failed to send email')
    }
  }
}
