package inspection_test

import (
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
)

func TestDetailIsEmptyUntilAFactIsRecorded(t *testing.T) {
	if !(inspection.Detail{}).Empty() {
		t.Fatal("a zero detail is empty")
	}
	for name, detail := range map[string]inspection.Detail{
		"format":  {Format: "udf"},
		"label":   {Label: "DISC"},
		"files":   {Files: 1},
		"folders": {Folders: 1},
		"track":   {Track: 2},
		"seconds": {Seconds: 1},
		"signals": {Signals: []string{"dpm"}},
	} {
		if detail.Empty() {
			t.Fatalf("a detail with %s is not empty", name)
		}
	}
}
