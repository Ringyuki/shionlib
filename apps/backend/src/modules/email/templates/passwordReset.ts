import { I18nService } from 'nestjs-i18n'

export const generatePasswordResetTemplate = (
  i18n: I18nService,
  resetLink: string,
  expSeconds = 600,
): string => {
  const expiresInMinutes = Math.ceil(expSeconds / 60)

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">${i18n.t('message.email.PASSWORD_RESET_SUBJECT')}</h2>
      <p>${i18n.t('message.email.PASSWORD_RESET_GREETING')}</p>
      <p>${i18n.t('message.email.PASSWORD_RESET_INSTRUCTION')}</p>
      <div style="text-align: center; margin: 30px 0;">
        <a
          href="${resetLink}"
          style="display: inline-block; background-color: #34a2d5; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px;"
        >
          ${i18n.t('message.email.PASSWORD_RESET_BUTTON')}
        </a>
      </div>
      <p style="color: #666;">${i18n.t('message.email.PASSWORD_RESET_LINK_EXPIRES', { args: { exp: expiresInMinutes } })}</p>
      <p style="color: #666;">${i18n.t('message.email.PASSWORD_RESET_COPY_LINK')}</p>
      <p><a href="${resetLink}" style="color: #34a2d5; word-break: break-all;">${resetLink}</a></p>
      <p style="color: #999; font-size: 12px;">${i18n.t('message.email.PASSWORD_RESET_IGNORE')}</p>
    </div>
  `
}
