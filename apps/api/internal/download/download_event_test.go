package download_test

import (
	"slices"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
)

func TestChangesToListsOnlyWhatDiffers(t *testing.T) {
	resource := download.Resource{Platforms: []string{"win"}, Languages: []string{"jp", "zh"}, Simulator: ptr("ONS"), Note: ptr("生肉")}

	same := resource.ChangesTo(download.ResourceChanges{Platforms: []string{"win"}, Languages: []string{"jp", "zh"}, Simulator: ptr("ONS")})
	if len(same) != 0 {
		t.Fatalf("an edit that changes nothing lists nothing, and a missing note leaves the note alone: %+v", same)
	}

	changed := resource.ChangesTo(download.ResourceChanges{Platforms: []string{"win", "and"}, Languages: []string{"jp"}, Note: ptr("官方中文")})
	fields := make([]download.EventField, len(changed))
	for i, change := range changed {
		fields[i] = change.Field
	}
	if !slices.Equal(fields, []download.EventField{download.FieldPlatforms, download.FieldLanguages, download.FieldSimulator, download.FieldNote}) {
		t.Fatalf("changed fields in a fixed order: %v", fields)
	}
	if simulator := changed[2]; !slices.Equal(simulator.Old, []string{"ONS"}) || len(simulator.New) != 0 {
		t.Fatalf("a cleared value is an empty list: %+v", simulator)
	}
	if note := changed[3]; !slices.Equal(note.Old, []string{"生肉"}) || !slices.Equal(note.New, []string{"官方中文"}) {
		t.Fatalf("note change: %+v", note)
	}
}
