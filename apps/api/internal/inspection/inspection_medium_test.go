package inspection_test

import (
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
)

func TestMediumNamesTheFormatsOfADiscAndItsRecoveryRecord(t *testing.T) {
	for name, tc := range map[string]struct {
		names   []string
		archive inspection.Archive
		want    string
	}{
		"an image with its sheet":               {[]string{"GAME.mds", "GAME.iso"}, inspection.Archive{}, "iso+mds"},
		"with a recovery record":                {[]string{"Disc/GAME.MDF", "Disc/GAME.MDS"}, inspection.Archive{Recovery: true, RecoveryPercent: 3}, "mdf+mds+rr3"},
		"a recovery record of unknown size":     {[]string{"a.bin", "a.cue"}, inspection.Archive{Recovery: true}, "bin+cue+rr"},
		"a CloneCD image":                       {[]string{"a.img", "a.sub", "a.ccd"}, inspection.Archive{}, "ccd+img+sub"},
		"two discs of the same formats":         {[]string{"d1.iso", "d1.mds", "d2.iso", "d2.mds"}, inspection.Archive{}, "iso+mds"},
		"a format that has no place of its own": {[]string{"a.b6t", "a.iso"}, inspection.Archive{}, "iso+b6t"},
		"no disc image":                         {nil, inspection.Archive{Recovery: true, RecoveryPercent: 3}, ""},
	} {
		if got := inspection.Medium(tc.names, tc.archive); got != tc.want {
			t.Errorf("%s: %q, want %q", name, got, tc.want)
		}
	}
}
