package composition_test

import (
	"fmt"
	"slices"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/composition"
)

func files(entries ...any) []composition.Entry {
	out := make([]composition.Entry, 0, len(entries)/2)
	for i := 0; i < len(entries); i += 2 {
		out = append(out, composition.Entry{Path: entries[i].(string), Size: int64(entries[i+1].(int))})
	}
	return out
}

func paths(changes []composition.Change) []string {
	out := make([]string, len(changes))
	for i, change := range changes {
		out[i] = change.Path
	}
	return out
}

var limelight = files(
	"ライムライト/LimelightLemonadeJam.exe", 900,
	"ライムライト/patch.xp3", 121,
	"ライムライト/data.xp3", 5000,
	"ライムライト/savedata/readme.txt", 3,
)

func TestAPatchFolderIsLaidOverTheFolderItSharesFilesWith(t *testing.T) {
	patch := files(
		"汉化补丁 v1.1/LimelightLemonadeJam_chs.exe", 942,
		"汉化补丁 v1.1/patch.xp3", 146,
		"汉化补丁 v1.1/patch_chs.xp3", 828,
		"汉化补丁 v1.1/汉化说明.txt", 3,
		"说明.txt", 1,
	)
	plan := composition.Draw(limelight, patch, composition.Placement{})
	if plan.GameDir != "ライムライト" || plan.PatchDir != "汉化补丁 v1.1" {
		t.Fatalf("places: %q %q", plan.GameDir, plan.PatchDir)
	}
	if !slices.Equal(paths(plan.Added), []string{"LimelightLemonadeJam_chs.exe", "patch_chs.xp3", "汉化说明.txt"}) || !slices.Equal(paths(plan.Replaced), []string{"patch.xp3"}) {
		t.Fatalf("changes: %v %v", paths(plan.Added), paths(plan.Replaced))
	}
	if old := plan.Replaced[0].OldSize; old == nil || *old != 121 || plan.Replaced[0].Size != 146 {
		t.Fatalf("a replaced file keeps its old size: %+v", plan.Replaced[0])
	}
	want := composition.Plan{
		Adds:      composition.Count{Files: 3, Size: 1773},
		Replaces:  composition.Count{Files: 1, Size: 146},
		Unchanged: composition.Count{Files: 3, Size: 5903},
		Total:     composition.Count{Files: 7, Size: 7822},
	}
	if plan.Adds != want.Adds || plan.Replaces != want.Replaces || plan.Unchanged != want.Unchanged || plan.Total != want.Total {
		t.Fatalf("counts: %+v", plan)
	}
	if plan.Empty() || len(plan.Conflicts) != 0 {
		t.Fatalf("a plan with changes: %+v", plan)
	}
}

func TestNamesAreMatchedWithoutRegardToCase(t *testing.T) {
	plan := composition.Draw(limelight, files("PATCH.XP3", 200, "SaveData/README.TXT", 9), composition.Placement{})
	if plan.GameDir != "ライムライト" || plan.PatchDir != composition.Root {
		t.Fatalf("places: %q %q", plan.GameDir, plan.PatchDir)
	}
	if plan.Replaces.Files != 2 || plan.Adds.Files != 0 || plan.Total.Files != 4 || plan.Total.Size != 900+200+5000+9 {
		t.Fatalf("both files replace what is there: %+v", plan)
	}
}

func TestDeeperFoldersOnBothSides(t *testing.T) {
	base := files("Top/Game/game.exe", 10, "Top/Game/data/a.dat", 5, "Top/Game/data/b.dat", 5, "Top/extra/a.dat", 1)
	patch := files("x/y/data/a.dat", 7, "x/y/data/b.dat", 7, "x/y/new.txt", 1, "x/readme.txt", 1)
	plan := composition.Draw(base, patch, composition.Placement{})
	if plan.GameDir != "Top/Game" || plan.PatchDir != "x/y" {
		t.Fatalf("places: %q %q", plan.GameDir, plan.PatchDir)
	}
	if !slices.Equal(paths(plan.Replaced), []string{"data/a.dat", "data/b.dat"}) || !slices.Equal(paths(plan.Added), []string{"new.txt"}) {
		t.Fatalf("changes: %v %v", paths(plan.Replaced), paths(plan.Added))
	}
}

func TestWithoutSharedFilesThePatchGoesBesideTheProgram(t *testing.T) {
	base := files("wrap/readme.txt", 1, "wrap/Game/start.exe", 10, "wrap/Game/data/deep.exe", 1, "wrap/Game/data.pak", 50)
	patch := files("only/inner/chs.pak", 5, "only/inner/说明.txt", 1)
	plan := composition.Draw(base, patch, composition.Placement{})
	if plan.GameDir != "wrap/Game" || plan.PatchDir != "only/inner" {
		t.Fatalf("places: %q %q", plan.GameDir, plan.PatchDir)
	}
	if plan.Adds.Files != 2 || plan.Replaces.Files != 0 || plan.Unchanged.Files != 4 {
		t.Fatalf("counts: %+v", plan)
	}
	bare := composition.Draw(files("a/x.bin", 1, "b/y.bin", 1), files("z.bin", 1), composition.Placement{})
	if bare.GameDir != composition.Root || bare.PatchDir != composition.Root {
		t.Fatalf("an archive without a program or a single folder is used from its root: %q %q", bare.GameDir, bare.PatchDir)
	}
}

func TestAChosenPlaceIsKeptWhenItExists(t *testing.T) {
	patch := files("汉化补丁/patch.xp3", 146, "other/patch.xp3", 1)
	game, missing, other := "ライムライト/savedata", "nowhere", "OTHER"
	plan := composition.Draw(limelight, patch, composition.Placement{GameDir: &game, PatchDir: &other})
	if plan.GameDir != "ライムライト/savedata" || plan.PatchDir != "OTHER" || plan.Adds.Files != 1 || plan.Added[0].Path != "patch.xp3" {
		t.Fatalf("chosen places: %+v", plan)
	}
	kept := composition.Draw(limelight, patch, composition.Placement{GameDir: &missing, PatchDir: &missing})
	if kept.GameDir != "ライムライト" || kept.PatchDir != "other" && kept.PatchDir != "汉化补丁" {
		t.Fatalf("a place that is not in the archive is not taken: %q %q", kept.GameDir, kept.PatchDir)
	}
	root := composition.Root
	top := composition.Draw(limelight, patch, composition.Placement{GameDir: &root, PatchDir: &root})
	if top.GameDir != composition.Root || top.PatchDir != composition.Root || top.Adds.Files != 2 {
		t.Fatalf("the root can be chosen: %+v", top)
	}
}

func TestAFileNeverTakesThePlaceOfAFolder(t *testing.T) {
	root := composition.Root
	plan := composition.Draw(limelight, files("ライムライト/savedata", 4, "ライムライト/patch.xp3/inner.bin", 4, "ライムライト/ok.txt", 1), composition.Placement{GameDir: &root, PatchDir: &root})
	if !slices.Equal(plan.Conflicts, []string{"ライムライト/patch.xp3/inner.bin", "ライムライト/savedata"}) || plan.Adds.Files != 1 || plan.Replaces.Files != 0 {
		t.Fatalf("conflicts: %+v", plan)
	}
}

func TestNamesFoundEverywhereDoNotDecideThePlace(t *testing.T) {
	var base []composition.Entry
	for i := range 70 {
		base = append(base, composition.Entry{Path: fmt.Sprintf("Game/save%02d/thumb.png", i), Size: 1})
	}
	base = append(base, composition.Entry{Path: "Game/main.exe", Size: 9}, composition.Entry{Path: "Game/script.pak", Size: 9})
	plan := composition.Draw(base, files("patch/thumb.png", 2, "patch/script.pak", 3), composition.Placement{})
	if plan.GameDir != "Game" || plan.PatchDir != "patch" || plan.Replaces.Files != 1 || plan.Adds.Files != 1 {
		t.Fatalf("places: %+v", plan)
	}
}

func TestFoldersOfferedAsPlaces(t *testing.T) {
	plan := composition.Draw(limelight, files("a/b/c/d/e/deep.txt", 1, "a/top.txt", 1), composition.Placement{})
	if !slices.Equal(plan.GameDirs, []composition.Dir{{Path: "", Items: 1}, {Path: "ライムライト", Items: 4}, {Path: "ライムライト/savedata", Items: 1}}) {
		t.Fatalf("folders of the game: %+v", plan.GameDirs)
	}
	want := []composition.Dir{{Path: "", Items: 1}, {Path: "a", Items: 2}, {Path: "a/b", Items: 1}, {Path: "a/b/c", Items: 1}, {Path: "a/b/c/d", Items: 1}}
	if !slices.Equal(plan.PatchDirs, want) {
		t.Fatalf("folders of the patch stop at a depth: %+v", plan.PatchDirs)
	}
}

func TestLongListsAreCutWhileCountsStayWhole(t *testing.T) {
	var patch []composition.Entry
	for i := range composition.ChangeListLimit + 25 {
		patch = append(patch, composition.Entry{Path: fmt.Sprintf("new%04d.bin", i), Size: 2})
	}
	root := "ライムライト"
	plan := composition.Draw(limelight, patch, composition.Placement{GameDir: &root})
	if len(plan.Added) != composition.ChangeListLimit || plan.Adds.Files != composition.ChangeListLimit+25 || plan.Added[0].Path != "new0000.bin" {
		t.Fatalf("added: %d of %d", len(plan.Added), plan.Adds.Files)
	}
}

func TestPathsAreCleaned(t *testing.T) {
	for raw, want := range map[string]string{`game\data\a.bin`: "game/data/a.bin", "../../etc/passwd": "etc/passwd", "/abs//x/./y": "abs/x/y", "": ""} {
		if got := composition.CleanPath(raw); got != want {
			t.Fatalf("%q: %q", raw, got)
		}
	}
	if rest, ok := composition.Within("Game/Data", "game/data/Sub/File.bin"); !ok || rest != "Sub/File.bin" {
		t.Fatalf("within: %q %v", rest, ok)
	}
	if _, ok := composition.Within("Game", "Game"); ok {
		t.Fatal("a folder is not inside itself")
	}
	if _, ok := composition.Within("Game", "Gamer/x"); ok {
		t.Fatal("a folder whose name only starts the same is another folder")
	}
}
