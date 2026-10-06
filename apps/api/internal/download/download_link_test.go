package download_test

import (
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
)

func TestLinkExpiryGrowsWithSizeAndIsCapped(t *testing.T) {
	expiry := download.LinkExpiry{Base: 1800 * time.Second, Speed: mib, Max: 86400 * time.Second}
	cases := map[int64]int64{
		25 << 30:  1800 + 25*1024,
		2 << 30:   1800 + 2*1024,
		200 << 30: 86400,
		1:         1801,
		0:         1800,
	}
	for size, want := range cases {
		if got := expiry.Seconds(size); got != want {
			t.Fatalf("size %d: got %d want %d", size, got, want)
		}
	}
	zeroSpeed := download.LinkExpiry{Base: time.Hour, Max: 24 * time.Hour}
	if got := zeroSpeed.Seconds(10); got != 3610 {
		t.Fatalf("speed is clamped to at least one byte per second: %d", got)
	}
}
