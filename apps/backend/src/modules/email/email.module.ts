import { Global, Module } from '@nestjs/common'
import { HttpModule, HttpService } from '@nestjs/axios'
import { ShionConfigService } from '../../common/config/services/config.service'
import { EmailService } from './services/email.service'
import { EMAIL_SENDER, EmailSender } from './interfaces/email-sender.interface'
import { ElasticEmailProvider } from './providers/elastic-email.provider'
import { PostalEmailProvider } from './providers/postal-email.provider'

@Global()
@Module({
  imports: [HttpModule],
  providers: [
    EmailService,
    {
      provide: EMAIL_SENDER,
      inject: [HttpService, ShionConfigService],
      useFactory: (httpService: HttpService, configService: ShionConfigService): EmailSender => {
        const provider = configService.get('email.emailProvider')
        const apiKey = configService.get('email.emailApiKey')
        const endPoint = configService.get('email.emailEndPoint')
        const senderAddress = configService.get('email.emailSenderAddress')
        const senderName = configService.get('email.emailSenderName')

        switch (provider) {
          case 'elastic':
            return new ElasticEmailProvider(
              httpService,
              apiKey,
              endPoint,
              senderAddress,
              senderName,
            )
          case 'postal':
            return new PostalEmailProvider(httpService, apiKey, endPoint, senderAddress, senderName)
          default:
            throw new Error(`Unsupported email provider: ${provider}`)
        }
      },
    },
  ],
  exports: [EmailService],
})
export class EmailModule {}
