import { I18nService } from 'nestjs-i18n'

export const generateVerificationCodeTemplate = (
  i18n: I18nService,
  code: string,
  expSeconds: number = 600,
): string => {
  const expiresInMinutes = Math.ceil(expSeconds / 60)

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">${i18n.t('message.email.VERIFICATION_CODE_SUBJECT')}</h2>
      <p>${i18n.t('message.email.VERIFICATION_CODE_PREFIX')}</p>
      <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
        <span style="font-size: 24px; font-weight: bold; color: #34a2d5;">${code}</span>
      </div>
      <p style="color: #666;">${i18n.t('message.email.VERIFICATION_CODE_SUFFIX', { args: { exp: expiresInMinutes } })}</p>
      <p style="color: #999; font-size: 12px;">${i18n.t('message.email.VERIFICATION_CODE_IGNORE')}</p>
    </div>
  `
}
