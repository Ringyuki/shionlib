package ai_test

import (
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

func TestRangeWindowsAlignToUTCPlusEightBuckets(t *testing.T) {
	now := time.Date(2026, 10, 3, 12, 34, 0, 0, time.UTC)
	first, count := ai.RangeWeek.Window(now)
	if count != 7 || !first.Equal(time.Date(2026, 9, 26, 16, 0, 0, 0, time.UTC)) {
		t.Fatalf("week %s %d", first, count)
	}
	first, count = ai.RangeHour.Window(now)
	if count != 12 || !first.Equal(time.Date(2026, 10, 3, 11, 35, 0, 0, time.UTC)) {
		t.Fatalf("hour %s %d", first, count)
	}
	if !ai.RangeMonth.Valid() || ai.Range("2h").Valid() {
		t.Fatal("validity")
	}
}
