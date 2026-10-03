package email

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/i18n"
	"github.com/Ringyuki/shionlib/apps/api/internal/report"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
)

var (
	_ report.AdminMailer = (*Mailer)(nil)
	_ scan.AdminMailer   = (*Mailer)(nil)
)

func TestReportAlertMatchesTheLegacyTemplate(t *testing.T) {
	catalog, err := i18n.Load(i18n.LocaleEN)
	if err != nil {
		t.Fatal(err)
	}
	sent := &recorder{}
	mailer := NewMailer(sent, catalog)
	detail := "<script>bad</script>"
	ctx := i18n.WithLocale(context.Background(), i18n.LocaleEN)
	err = mailer.ReportFiled(ctx, []string{"a@example.test", "", "b@example.test"}, report.ReportAlert{
		ReportID: 7, ReporterName: "alice", ReportedUserName: "bob", Reason: report.ReasonMalware, Level: report.LevelCritical,
		GameTitle: "ゲーム", Detail: &detail, ReviewURL: "https://shionlib.com/admin/reports/7",
	})
	if err != nil {
		t.Fatal(err)
	}
	mail := sent.messages[0]
	for _, want := range []string{"#7", "alice", "bob", "ゲーム", ">Malware<", "Critical", "background-color: #8b0000", `href="https://shionlib.com/admin/reports/7"`, "&lt;script&gt;"} {
		if !strings.Contains(mail.HTML, want) {
			t.Fatalf("report mail misses %q:\n%s", want, mail.HTML)
		}
	}
	if mail.Subject != "Shionlib Download Resource Report Notification" || len(mail.To) != 2 {
		t.Fatalf("unexpected report mail %+v", mail)
	}
	if err := mailer.ReportFiled(ctx, nil, report.ReportAlert{}); err != nil || len(sent.messages) != 1 {
		t.Fatalf("no recipients means no mail: %v", err)
	}
}

func TestMalwareAlertMatchesTheLegacyTemplate(t *testing.T) {
	catalog, err := i18n.Load(i18n.LocaleEN)
	if err != nil {
		t.Fatal(err)
	}
	sent := &recorder{}
	mailer := NewMailer(sent, catalog)
	ctx := i18n.WithLocale(context.Background(), i18n.LocaleEN)
	deadline := time.Date(2026, 10, 4, 1, 2, 3, 0, time.UTC)
	if err := mailer.MalwareDetected(ctx, []string{"a@example.test"}, scan.MalwareAlert{CaseID: 3, FileName: "a.zip", UploaderName: "carol", GameTitle: "Game", Viruses: []string{"Eicar", "Trojan"}, Deadline: deadline, ReviewURL: "https://shionlib.com/admin/malware/3"}); err != nil {
		t.Fatal(err)
	}
	mail := sent.messages[0]
	for _, want := range []string{"#3", "a.zip", "carol", "Eicar, Trojan", "2026-10-04T01:02:03Z", "Review Malware Case"} {
		if !strings.Contains(mail.HTML, want) {
			t.Fatalf("malware mail misses %q:\n%s", want, mail.HTML)
		}
	}
	if err := mailer.MalwareDetected(ctx, []string{"a@example.test"}, scan.MalwareAlert{}); err != nil || !strings.Contains(sent.messages[1].HTML, ">-<") {
		t.Fatalf("an empty virus list renders a dash: %v", err)
	}
}
