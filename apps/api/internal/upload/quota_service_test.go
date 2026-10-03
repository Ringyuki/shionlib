package upload_test

import (
	"context"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload/uploadtest"
)

func TestQuotaGetDefaultsToZero(t *testing.T) {
	f := newFixture()
	got, err := f.quota.Get(context.Background(), 42)
	if err != nil || got.Size != 0 || got.Used != 0 {
		t.Fatalf("missing quota row reads as zero: %+v %v", got, err)
	}
}

func TestAdjustUsedRules(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	expectCode(t, f.quota.AdjustUsed(ctx, 9, upload.ActionUse, 1, "", nil), upload.ErrQuotaNotFound)
	f.quotas.SeedQuota(upload.Quota{UserID: 1, Size: 10, Used: 4})
	expectCode(t, f.quota.AdjustUsed(ctx, 1, upload.ActionUse, 7, "", nil), upload.ErrQuotaExceeded)
	expectCode(t, f.quota.AdjustUsed(ctx, 1, upload.ActionAdd, 5, "", nil), upload.ErrQuotaUsedCantBeNegative)
	if err := f.quota.AdjustUsed(ctx, 1, upload.ActionUse, 6, "", nil); err != nil {
		t.Fatal(err)
	}
	if err := f.quota.AdjustUsed(ctx, 1, upload.ActionAdd, 3, "ADMIN", nil); err != nil {
		t.Fatal(err)
	}
	if got := f.quotas.Quota(1); got.Used != 7 {
		t.Fatalf("used %d", got.Used)
	}
}

func TestWithdrawReversesTheSessionChargeOnce(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	f.quotas.SeedQuota(upload.Quota{UserID: 1, Size: 100})
	session := 7
	if err := f.quota.AdjustUsed(ctx, 1, upload.ActionUse, 40, upload.ReasonGameUpload, &session); err != nil {
		t.Fatal(err)
	}
	for range 2 {
		if err := f.quota.Withdraw(ctx, 1, session); err != nil {
			t.Fatal(err)
		}
	}
	if got := f.quotas.Quota(1); got.Used != 0 {
		t.Fatalf("withdraw must be idempotent: %+v", got)
	}
	if err := f.quota.Withdraw(ctx, 99, session); err != nil {
		t.Fatalf("withdrawing for a user without quota is a no-op: %v", err)
	}
}

func TestAdjustSizeAndGrants(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	f.quotas.SeedQuota(upload.Quota{UserID: 1, Size: 10})
	amount, err := f.quota.AdjustSize(ctx, 1, upload.ActionSub, 25, "REPORT_MALWARE")
	if err != nil || amount != 25 || f.quotas.Quota(1).Size != -15 {
		t.Fatalf("size can go negative: %d %v %+v", amount, err, f.quotas.Quota(1))
	}
	if err := f.quota.InitialGrant(ctx, 1); err != nil {
		t.Fatal(err)
	}
	if err := f.quota.InitialGrant(ctx, 1); err != nil {
		t.Fatal(err)
	}
	got := f.quotas.Quota(1)
	if got.Size != 85 || !got.IsFirstGrant {
		t.Fatalf("initial grant applies once: %+v", got)
	}
}

func TestResetUsedAndResetQuota(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	f.quotas.SeedQuota(upload.Quota{UserID: 1, Size: 50, Used: 20})
	f.quotas.SeedQuota(upload.Quota{UserID: 2, Size: 0, Used: 0})
	if err := f.quota.ResetUsed(ctx, 1); err != nil {
		t.Fatal(err)
	}
	if err := f.quota.ResetUsed(ctx, 2); err != nil {
		t.Fatal(err)
	}
	if err := f.quota.ResetQuota(ctx, 1); err != nil {
		t.Fatal(err)
	}
	if err := f.quota.ResetQuota(ctx, 2); err != nil {
		t.Fatal(err)
	}
	if got := f.quotas.Quota(1); got.Used != 0 || got.Size != 0 {
		t.Fatalf("reset %+v", got)
	}
	records := f.quotas.Records()
	if len(records) != 2 || *records[0].Reason != upload.ReasonResetUsed || records[0].Amount != 20 || *records[1].Reason != upload.ReasonResetQuota {
		t.Fatalf("no zero-amount records are written: %+v", records)
	}
}

func TestDynamicTopupAndReduce(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	f.quotas.SeedQuota(upload.Quota{UserID: 1, Size: 100, Used: 80, IsFirstGrant: true})
	f.quotas.SeedQuota(upload.Quota{UserID: 2, Size: 100, Used: 10, IsFirstGrant: true})
	f.quotas.SeedQuota(upload.Quota{UserID: 3, Size: 100, Used: 90})
	f.quotas.SeedApprovedFile(uploadtest.ApprovedFile{CreatorID: 1, Created: now.Add(-time.Hour)})
	f.quotas.SeedApprovedFile(uploadtest.ApprovedFile{CreatorID: 3, Created: now.Add(-time.Hour)})
	for _, id := range []int{1, 2, 3} {
		if err := f.quota.DynamicTopup(ctx, id); err != nil {
			t.Fatal(err)
		}
	}
	if f.quotas.Quota(1).Size != 150 || f.quotas.Quota(2).Size != 100 || f.quotas.Quota(3).Size != 100 {
		t.Fatalf("topup only when granted, low on space and active this month: %+v %+v %+v", f.quotas.Quota(1), f.quotas.Quota(2), f.quotas.Quota(3))
	}
	if err := f.quota.DynamicReduce(ctx, 1); err != nil {
		t.Fatal(err)
	}
	if f.quotas.Quota(1).Size != 150 {
		t.Fatalf("recent approvals block reductions: %+v", f.quotas.Quota(1))
	}
	f.quotas.SeedQuota(upload.Quota{UserID: 4, Size: 110, IsFirstGrant: true})
	if err := f.quota.DynamicReduce(ctx, 4); err != nil {
		t.Fatal(err)
	}
	if err := f.quota.DynamicReduce(ctx, 4); err != nil {
		t.Fatal(err)
	}
	if f.quotas.Quota(4).Size != 100 {
		t.Fatalf("reductions stop at the base size: %+v", f.quotas.Quota(4))
	}
}

func TestScheduledRunsWalkEligibleUsers(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	f.quotas.SeedMember(uploadtest.Member{ID: 1, Active: true, Created: now.AddDate(0, 0, -8), LastSeen: now})
	f.quotas.SeedMember(uploadtest.Member{ID: 2, Active: true, Created: now.AddDate(0, 0, -1), LastSeen: now.AddDate(0, 0, -200)})
	f.quotas.SeedMember(uploadtest.Member{ID: 3, Active: true, Admin: true, Created: now.AddDate(0, 0, -30)})
	f.quotas.SeedMember(uploadtest.Member{ID: 4, Active: true, Created: now.AddDate(0, 0, -30)})
	f.quotas.SeedQuota(upload.Quota{UserID: 1})
	f.quotas.SeedQuota(upload.Quota{UserID: 2, Size: 30})
	f.quotas.SeedQuota(upload.Quota{UserID: 3})
	if err := f.quota.RunInitialGrants(ctx); err != nil {
		t.Fatal(err)
	}
	if f.quotas.Quota(1).Size != 100 || f.quotas.Quota(2).Size != 30 || f.quotas.Quota(3).Size != 0 {
		t.Fatalf("grants: %+v %+v %+v", f.quotas.Quota(1), f.quotas.Quota(2), f.quotas.Quota(3))
	}
	if err := f.quota.RunInactiveResets(ctx); err != nil {
		t.Fatal(err)
	}
	if f.quotas.Quota(2).Size != 0 || f.quotas.Quota(1).Size != 100 {
		t.Fatalf("inactive users lose their quota: %+v %+v", f.quotas.Quota(1), f.quotas.Quota(2))
	}
	if err := f.quota.RunMonthlyResets(ctx); err != nil {
		t.Fatalf("users without quota rows are skipped: %v", err)
	}
}
