package inspection_test

import (
	"slices"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
)

func TestNaturalCompareOrdersNumbersByValueAndIgnoresCase(t *testing.T) {
	names := []string{"v_10.ogg", "V_2.ogg", "v_1.ogg", "readme.txt", "Readme.txt", "v_02.ogg", "v_2.ogg", "データ", "bgm", "bgm2", "BGM10"}
	slices.SortFunc(names, inspection.NaturalCompare)
	want := []string{"bgm", "bgm2", "BGM10", "Readme.txt", "readme.txt", "v_1.ogg", "V_2.ogg", "v_2.ogg", "v_02.ogg", "v_10.ogg", "データ"}
	if !slices.Equal(names, want) {
		t.Fatalf("got %v", names)
	}
	if inspection.NaturalCompare("a", "a") != 0 {
		t.Fatal("a name equals itself")
	}
}

func TestContainersAreArchivesAndDiscImages(t *testing.T) {
	for kind, want := range map[inspection.Kind]bool{
		inspection.KindArchive: true,
		inspection.KindDisc:    true,
		inspection.KindFolder:  false,
		inspection.KindFile:    false,
		inspection.KindTrack:   false,
	} {
		if kind.Container() != want {
			t.Fatalf("%s: got %v", kind, kind.Container())
		}
	}
}

func TestADraftHoldsOnlyNamesThatAreText(t *testing.T) {
	var draft inspection.Draft
	index := draft.AddTop(inspection.DraftEntry{Name: "DISC\x00\xb2\xdd.BIN", Kind: inspection.KindFile})
	if got := draft.Entries[index].Name; got != "DISC\uFFFD.BIN" {
		t.Fatalf("got %q", got)
	}
}
