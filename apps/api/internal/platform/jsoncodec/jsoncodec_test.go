package jsoncodec_test

import (
	"bytes"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/jsoncodec"
)

type timed struct {
	At       time.Time  `json:"at"`
	Maybe    *time.Time `json:"maybe"`
	Missing  *time.Time `json:"missing"`
	Optional *time.Time `json:"optional,omitempty"`
	HTML     string     `json:"html"`
	Items    []int      `json:"items"`
}

func TestTimesUseTheJavaScriptISOFormat(t *testing.T) {
	local := time.FixedZone("CST", 8*60*60)
	at := time.Date(2026, 10, 3, 9, 2, 3, 456789000, local)
	whole := time.Date(2026, 10, 3, 1, 2, 3, 0, time.UTC)
	raw, err := jsoncodec.Marshal(timed{At: at, Maybe: &whole, HTML: "<b>&</b>"})
	if err != nil {
		t.Fatal(err)
	}
	want := `{"at":"2026-10-03T01:02:03.456Z","maybe":"2026-10-03T01:02:03.000Z","missing":null,"html":"<b>&</b>","items":null}`
	if string(raw) != want {
		t.Fatalf("got  %s\nwant %s", raw, want)
	}
	var buf bytes.Buffer
	if err := jsoncodec.Encode(&buf, map[string]time.Time{"t": whole}); err != nil {
		t.Fatal(err)
	}
	if buf.String() != "{\"t\":\"2026-10-03T01:02:03.000Z\"}\n" {
		t.Fatalf("encoded %q", buf.String())
	}
}
