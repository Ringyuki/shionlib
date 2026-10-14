package scan_test

import (
	"slices"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
)

func TestOnlyAdministratorsReleasesThatNoAdministratorOverruledAreTrusted(t *testing.T) {
	trusted := scan.Trusted([]scan.Verdict{
		{Signature: "Packed.A", Source: scan.SourceAdminAllow},
		{Signature: "Trojan.B", Source: scan.SourceAdminAllow},
		{Signature: "Trojan.B", Source: scan.SourceAdminDelete},
		{Signature: "Worm.C", Source: scan.SourceTimeoutAutoDelete},
		{Signature: "Worm.C", Source: scan.SourceAdminAllow},
	})
	if !slices.Equal(trusted, []string{"Packed.A", "Worm.C"}) {
		t.Fatalf("trusted %v", trusted)
	}
}
