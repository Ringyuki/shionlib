package email

import (
	"context"
	"html/template"
	"strings"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/i18n"
	"github.com/Ringyuki/shionlib/apps/api/internal/report"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
)

var reportTemplate = template.Must(template.New("report").Parse(`
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #d9534f;">{{.Subject}}</h2>
      <p>{{.Intro}}</p>
      <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666; width: 120px;">{{.ReportIDLabel}}:</td>
            <td style="padding: 8px 0; font-weight: bold;">#{{.ReportID}}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">{{.ReporterLabel}}:</td>
            <td style="padding: 8px 0;">{{.Reporter}}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">{{.ReportedLabel}}:</td>
            <td style="padding: 8px 0;">{{.Reported}}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">{{.GameLabel}}:</td>
            <td style="padding: 8px 0;">{{.Game}}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">{{.ReasonLabel}}:</td>
            <td style="padding: 8px 0;">{{.Reason}}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">{{.LevelLabel}}:</td>
            <td style="padding: 8px 0;">
              <span style="background-color: {{.LevelColor}}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
                {{.Level}}
              </span>
            </td>
          </tr>
          {{- if .Detail}}
          <tr>
            <td style="padding: 8px 0; color: #666; vertical-align: top;">{{.DetailLabel}}:</td>
            <td style="padding: 8px 0;">{{.Detail}}</td>
          </tr>
          {{- end}}
        </table>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{.ReviewURL}}"
           style="background-color: #34a2d5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          {{.Review}}
        </a>
      </div>
      <p style="color: #999; font-size: 12px;">{{.Footer}}</p>
    </div>
`))

var malwareTemplate = template.Must(template.New("malware").Parse(`
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
      <h2 style="color: #d9534f;">{{.Subject}}</h2>
      <p>{{.Intro}}</p>
      <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666; width: 180px;">{{.CaseIDLabel}}:</td>
            <td style="padding: 8px 0; font-weight: bold;">#{{.CaseID}}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">{{.FileLabel}}:</td>
            <td style="padding: 8px 0;">{{.File}}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">{{.UploaderLabel}}:</td>
            <td style="padding: 8px 0;">{{.Uploader}}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">{{.GameLabel}}:</td>
            <td style="padding: 8px 0;">{{.Game}}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">{{.VirusesLabel}}:</td>
            <td style="padding: 8px 0;">{{.Viruses}}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">{{.DeadlineLabel}}:</td>
            <td style="padding: 8px 0;">{{.Deadline}}</td>
          </tr>
        </table>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{.ReviewURL}}"
           style="background-color: #34a2d5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          {{.Review}}
        </a>
      </div>
      <p style="color: #999; font-size: 12px;">{{.Footer}}</p>
    </div>
`))

func (m *Mailer) ReportFiled(ctx context.Context, recipients []string, alert report.ReportAlert) error {
	t := m.translator(ctx)
	subject := t("REPORT_NOTIFICATION_SUBJECT", nil)
	detail := ""
	if alert.Detail != nil {
		detail = *alert.Detail
	}
	html, err := render(reportTemplate, map[string]any{
		"Subject":       subject,
		"Intro":         t("REPORT_NOTIFICATION_INTRO", nil),
		"ReportIDLabel": t("REPORT_ID", nil),
		"ReportID":      alert.ReportID,
		"ReporterLabel": t("REPORTER", nil),
		"Reporter":      alert.ReporterName,
		"ReportedLabel": t("REPORTED_USER", nil),
		"Reported":      alert.ReportedUserName,
		"GameLabel":     t("GAME", nil),
		"Game":          alert.GameTitle,
		"ReasonLabel":   t("REASON", nil),
		"Reason":        m.message(ctx, "message.report.reason."+string(alert.Reason)),
		"LevelLabel":    t("MALICIOUS_LEVEL", nil),
		"Level":         m.message(ctx, "message.report.level."+string(alert.Level)),
		"LevelColor":    levelColor(alert.Level),
		"DetailLabel":   t("DETAIL", nil),
		"Detail":        detail,
		"ReviewURL":     alert.ReviewURL,
		"Review":        t("REVIEW_REPORT", nil),
		"Footer":        t("REPORT_NOTIFICATION_FOOTER", nil),
	})
	if err != nil {
		return err
	}
	return m.sendAll(ctx, recipients, subject, html)
}

func (m *Mailer) MalwareDetected(ctx context.Context, recipients []string, alert scan.MalwareAlert) error {
	t := m.translator(ctx)
	subject := t("MALWARE_SCAN_NOTIFICATION_SUBJECT", nil)
	viruses := "-"
	if len(alert.Viruses) > 0 {
		viruses = strings.Join(alert.Viruses, ", ")
	}
	html, err := render(malwareTemplate, map[string]any{
		"Subject":       subject,
		"Intro":         t("MALWARE_SCAN_NOTIFICATION_INTRO", nil),
		"CaseIDLabel":   t("MALWARE_CASE_ID", nil),
		"CaseID":        alert.CaseID,
		"FileLabel":     t("FILE_NAME", nil),
		"File":          alert.FileName,
		"UploaderLabel": t("UPLOADER", nil),
		"Uploader":      alert.UploaderName,
		"GameLabel":     t("GAME", nil),
		"Game":          alert.GameTitle,
		"VirusesLabel":  t("DETECTED_VIRUSES", nil),
		"Viruses":       viruses,
		"DeadlineLabel": t("REVIEW_DEADLINE", nil),
		"Deadline":      alert.Deadline.UTC().Format(time.RFC3339Nano),
		"ReviewURL":     alert.ReviewURL,
		"Review":        t("REVIEW_MALWARE_CASE", nil),
		"Footer":        t("REPORT_NOTIFICATION_FOOTER", nil),
	})
	if err != nil {
		return err
	}
	return m.sendAll(ctx, recipients, subject, html)
}

func (m *Mailer) sendAll(ctx context.Context, recipients []string, subject, html string) error {
	to := make([]string, 0, len(recipients))
	for _, recipient := range recipients {
		if recipient != "" {
			to = append(to, recipient)
		}
	}
	if len(to) == 0 {
		return nil
	}
	return m.sender.Send(ctx, Message{Subject: subject, To: to, HTML: html})
}

func (m *Mailer) message(ctx context.Context, key string) string {
	locale, ok := i18n.FromContext(ctx)
	if !ok {
		locale = m.catalog.Fallback()
	}
	return m.catalog.T(locale, key, nil)
}

func levelColor(level report.Level) string {
	switch level {
	case report.LevelLow:
		return "#5cb85c"
	case report.LevelMedium:
		return "#f0ad4e"
	case report.LevelHigh:
		return "#d9534f"
	case report.LevelCritical:
		return "#8b0000"
	default:
		return "#666"
	}
}
