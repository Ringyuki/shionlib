import { I18nService } from 'nestjs-i18n'
import { ReportMaliciousLevel } from '@prisma/client'
import { ReportNotificationData } from '../interfaces/email.interface'

export const generateReportNotificationTemplate = (
  i18n: I18nService,
  data: ReportNotificationData,
): string => {
  const reasonLabel = i18n.t(`message.report.reason.${data.reason}`)
  const levelLabel = i18n.t(`message.report.level.${data.maliciousLevel}`)

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #d9534f;">${i18n.t('message.email.REPORT_NOTIFICATION_SUBJECT')}</h2>
      <p>${i18n.t('message.email.REPORT_NOTIFICATION_INTRO')}</p>

      <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666; width: 120px;">${i18n.t('message.email.REPORT_ID')}:</td>
            <td style="padding: 8px 0; font-weight: bold;">#${data.reportId}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">${i18n.t('message.email.REPORTER')}:</td>
            <td style="padding: 8px 0;">${data.reporterName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">${i18n.t('message.email.REPORTED_USER')}:</td>
            <td style="padding: 8px 0;">${data.reportedUserName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">${i18n.t('message.email.GAME')}:</td>
            <td style="padding: 8px 0;">${data.gameTitle}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">${i18n.t('message.email.REASON')}:</td>
            <td style="padding: 8px 0;">${reasonLabel}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">${i18n.t('message.email.MALICIOUS_LEVEL')}:</td>
            <td style="padding: 8px 0;">
              <span style="background-color: ${getLevelColor(data.maliciousLevel)}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
                ${levelLabel}
              </span>
            </td>
          </tr>
          ${
            data.detail
              ? `
          <tr>
            <td style="padding: 8px 0; color: #666; vertical-align: top;">${i18n.t('message.email.DETAIL')}:</td>
            <td style="padding: 8px 0;">${data.detail}</td>
          </tr>
          `
              : ''
          }
        </table>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${data.adminReviewUrl}"
           style="background-color: #34a2d5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          ${i18n.t('message.email.REVIEW_REPORT')}
        </a>
      </div>

      <p style="color: #999; font-size: 12px;">${i18n.t('message.email.REPORT_NOTIFICATION_FOOTER')}</p>
    </div>
  `
}

function getLevelColor(level: ReportMaliciousLevel): string {
  switch (level) {
    case ReportMaliciousLevel.LOW:
      return '#5cb85c'
    case ReportMaliciousLevel.MEDIUM:
      return '#f0ad4e'
    case ReportMaliciousLevel.HIGH:
      return '#d9534f'
    case ReportMaliciousLevel.CRITICAL:
      return '#8b0000'
    default:
      return '#666'
  }
}
