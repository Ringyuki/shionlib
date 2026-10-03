package email

import (
	"bytes"
	"context"
	"fmt"
	"html/template"
	"math"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/i18n"
)

var verificationTemplate = template.Must(template.New("verification").Parse(`
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">{{.Subject}}</h2>
      <p>{{.Prefix}}</p>
      <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
        <span style="font-size: 24px; font-weight: bold; color: #34a2d5;">{{.Code}}</span>
      </div>
      <p style="color: #666;">{{.Suffix}}</p>
      <p style="color: #999; font-size: 12px;">{{.Ignore}}</p>
    </div>
`))

var resetTemplate = template.Must(template.New("reset").Parse(`
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">{{.Subject}}</h2>
      <p>{{.Greeting}}</p>
      <p>{{.Instruction}}</p>
      <div style="text-align: center; margin: 30px 0;">
        <a
          href="{{.Link}}"
          style="display: inline-block; background-color: #34a2d5; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px;"
        >
          {{.Button}}
        </a>
      </div>
      <p style="color: #666;">{{.Expires}}</p>
      <p style="color: #666;">{{.CopyLink}}</p>
      <p><a href="{{.Link}}" style="color: #34a2d5; word-break: break-all;">{{.Link}}</a></p>
      <p style="color: #999; font-size: 12px;">{{.Ignore}}</p>
    </div>
`))

type Mailer struct {
	sender  Sender
	catalog *i18n.Catalog
}

func NewMailer(sender Sender, catalog *i18n.Catalog) *Mailer {
	return &Mailer{sender: sender, catalog: catalog}
}

func (m *Mailer) SendVerificationCode(ctx context.Context, to, code string, ttl time.Duration) error {
	t := m.translator(ctx)
	subject := t("VERIFICATION_CODE_SUBJECT", nil)
	html, err := render(verificationTemplate, map[string]any{
		"Subject": subject,
		"Prefix":  t("VERIFICATION_CODE_PREFIX", nil),
		"Code":    code,
		"Suffix":  t("VERIFICATION_CODE_SUFFIX", map[string]any{"exp": minutes(ttl)}),
		"Ignore":  t("VERIFICATION_CODE_IGNORE", nil),
	})
	if err != nil {
		return err
	}
	return m.send(ctx, Message{Subject: subject, To: []string{to}, HTML: html})
}

func (m *Mailer) SendPasswordReset(ctx context.Context, to, link string, ttl time.Duration) error {
	t := m.translator(ctx)
	subject := t("PASSWORD_RESET_SUBJECT", nil)
	html, err := render(resetTemplate, map[string]any{
		"Subject":     subject,
		"Greeting":    t("PASSWORD_RESET_GREETING", nil),
		"Instruction": t("PASSWORD_RESET_INSTRUCTION", nil),
		"Link":        link,
		"Button":      t("PASSWORD_RESET_BUTTON", nil),
		"Expires":     t("PASSWORD_RESET_LINK_EXPIRES", map[string]any{"exp": minutes(ttl)}),
		"CopyLink":    t("PASSWORD_RESET_COPY_LINK", nil),
		"Ignore":      t("PASSWORD_RESET_IGNORE", nil),
	})
	if err != nil {
		return err
	}
	return m.send(ctx, Message{Subject: subject, To: []string{to}, HTML: html})
}

func (m *Mailer) send(ctx context.Context, msg Message) error {
	if len(msg.To) == 0 || msg.To[0] == "" {
		return errNoRecipient
	}
	return m.sender.Send(ctx, msg)
}

func (m *Mailer) translator(ctx context.Context) func(key string, args map[string]any) string {
	locale, ok := i18n.FromContext(ctx)
	if !ok {
		locale = m.catalog.Fallback()
	}
	return func(key string, args map[string]any) string {
		return m.catalog.T(locale, "message.email."+key, args)
	}
}

func render(tmpl *template.Template, data map[string]any) (string, error) {
	var out bytes.Buffer
	if err := tmpl.Execute(&out, data); err != nil {
		return "", fmt.Errorf("render %s email: %w", tmpl.Name(), err)
	}
	return out.String(), nil
}

func minutes(ttl time.Duration) int {
	return int(math.Ceil(ttl.Seconds() / 60))
}
