package email

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/i18n"
)

type recorder struct {
	messages []Message
}

func (r *recorder) Send(_ context.Context, msg Message) error {
	r.messages = append(r.messages, msg)
	return nil
}

func TestMailerRendersLocalizedTemplates(t *testing.T) {
	catalog, err := i18n.Load(i18n.LocaleEN)
	if err != nil {
		t.Fatal(err)
	}
	sent := &recorder{}
	mailer := NewMailer(sent, catalog)
	ctx := i18n.WithLocale(context.Background(), i18n.LocaleZH)
	if err := mailer.SendVerificationCode(ctx, "a@example.test", "ABC123", 30*time.Minute); err != nil {
		t.Fatal(err)
	}
	code := sent.messages[0]
	if code.Subject != catalog.T(i18n.LocaleZH, "message.email.VERIFICATION_CODE_SUBJECT", nil) || !strings.Contains(code.HTML, "ABC123") || !strings.Contains(code.HTML, "30") || code.To[0] != "a@example.test" {
		t.Fatalf("unexpected verification mail %+v", code)
	}
	link := "https://shionlib.com/user/password/forget?token=t&email=a%40example.test"
	if err := mailer.SendPasswordReset(context.Background(), "a@example.test", link, 10*time.Minute); err != nil {
		t.Fatal(err)
	}
	reset := sent.messages[1]
	if reset.Subject != "Reset your Shionlib password" || !strings.Contains(reset.HTML, `href="https://shionlib.com/user/password/forget?token=t&amp;email=a%40example.test"`) || !strings.Contains(reset.HTML, "10 minutes") {
		t.Fatalf("unexpected reset mail %s", reset.HTML)
	}
	if err := mailer.SendVerificationCode(ctx, "", "x", time.Minute); err == nil {
		t.Fatal("a recipient is required")
	}
}
