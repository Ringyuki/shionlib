export const EMAIL_SENDER = Symbol('EMAIL_SENDER')

export interface SendEmailParams {
  subject: string
  to: string | string[]
  bodyHtml: string
  from?: string
}

export interface EmailSender {
  send(params: SendEmailParams): Promise<boolean>
}
