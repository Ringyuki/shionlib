package upload_test

import (
	"context"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

func TestAllowanceDependsOnTheTier(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	f.quotas.SeedUsage(uploader.UserID, 40, 5)
	allowance, err := f.quota.Allowance(ctx, uploader.UserID)
	if err != nil {
		t.Fatal(err)
	}
	if allowance.Tier != upload.TierNew || *allowance.StoredLimit != 100 || *allowance.MaxFileSize != 16 || allowance.Stored != 40 || allowance.InFlight != 5 || allowance.InFlightLimit != 50 {
		t.Fatalf("new uploader %+v", allowance)
	}
	if err := f.quota.SetTrusted(ctx, uploader.UserID, true); err != nil {
		t.Fatal(err)
	}
	trusted, _ := f.quota.Allowance(ctx, uploader.UserID)
	if trusted.Tier != upload.TierTrusted || !trusted.Trusted || *trusted.StoredLimit != 1000 || trusted.MaxFileSize != nil {
		t.Fatalf("trusted uploader %+v", trusted)
	}
	f.quotas.SeedStanding(admin.UserID, upload.Standing{Role: actor.RoleAdmin})
	if admins, _ := f.quota.Allowance(ctx, admin.UserID); admins.StoredLimit != nil || admins.MaxFileSize != nil {
		t.Fatalf("admins have no stored or file limit: %+v", admins)
	}
}
