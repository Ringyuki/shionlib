package upload_test

import (
	"context"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

func lastRecord(t *testing.T, f fixture) upload.QuotaRecord {
	t.Helper()
	records := f.quotas.Records()
	if len(records) == 0 {
		t.Fatal("no quota record written")
	}
	return records[len(records)-1]
}

func TestAdminAdjustSizeCreatesTheQuotaAndKeepsUsedCovered(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	if err := f.quota.AdminAdjustSize(ctx, 7, upload.ActionAdd, 100, ""); err != nil {
		t.Fatal(err)
	}
	if got := f.quotas.Quota(7); got.Size != 100 || got.Used != 0 || got.IsFirstGrant {
		t.Fatalf("missing quota rows are created: %+v", got)
	}
	if record := lastRecord(t, f); record.Field != upload.FieldSize || record.Action != upload.ActionAdd || record.Amount != 100 || *record.Reason != upload.ReasonAdminAdjust {
		t.Fatalf("record: %+v", record)
	}
	if err := f.quota.AdminAdjustUsed(ctx, 7, upload.ActionUse, 60, "manual"); err != nil {
		t.Fatal(err)
	}
	expectCode(t, f.quota.AdminAdjustSize(ctx, 7, upload.ActionSub, 41, ""), upload.ErrQuotaExceeded)
	if err := f.quota.AdminAdjustSize(ctx, 7, upload.ActionSub, 40, "shrink"); err != nil {
		t.Fatal(err)
	}
	if got := f.quotas.Quota(7); got.Size != 60 || got.Used != 60 {
		t.Fatalf("size may shrink down to used: %+v", got)
	}
	if record := lastRecord(t, f); record.Action != upload.ActionSub || *record.Reason != "shrink" {
		t.Fatalf("record: %+v", record)
	}
}

func TestAdminAdjustUsedRules(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	expectCode(t, f.quota.AdminAdjustUsed(ctx, 3, upload.ActionUse, 1, ""), upload.ErrQuotaExceeded)
	if got := f.quotas.Quota(3); got.ID == 0 {
		t.Fatal("the quota row is created before the check")
	}
	f.quotas.SeedQuota(upload.Quota{UserID: 4, Size: 10, Used: 4})
	expectCode(t, f.quota.AdminAdjustUsed(ctx, 4, upload.ActionAdd, 5, ""), upload.ErrQuotaUsedCantBeNegative)
	if err := f.quota.AdminAdjustUsed(ctx, 4, upload.ActionAdd, 4, ""); err != nil {
		t.Fatal(err)
	}
	if got := f.quotas.Quota(4); got.Used != 0 {
		t.Fatalf("ADD gives quota back: %+v", got)
	}
	if record := lastRecord(t, f); record.Field != upload.FieldUsed || *record.Reason != upload.ReasonAdminAdjust {
		t.Fatalf("record: %+v", record)
	}
}

func TestAdminResetUsed(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	if err := f.quota.AdminResetUsed(ctx, 5); err != nil {
		t.Fatal(err)
	}
	if got := f.quotas.Quota(5); got.ID == 0 || len(f.quotas.Records()) != 0 {
		t.Fatalf("resetting an unused quota only creates the row: %+v %v", got, f.quotas.Records())
	}
	f.quotas.SeedQuota(upload.Quota{UserID: 6, Size: 10, Used: 9})
	if err := f.quota.AdminResetUsed(ctx, 6); err != nil {
		t.Fatal(err)
	}
	if got := f.quotas.Quota(6); got.Used != 0 {
		t.Fatalf("used reset: %+v", got)
	}
	if record := lastRecord(t, f); record.Action != upload.ActionAdd || record.Amount != 9 || *record.Reason != upload.ReasonAdminResetUsed {
		t.Fatalf("record: %+v", record)
	}
}
