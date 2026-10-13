package composition_test

import (
	"slices"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/composition"
)

func dir(name string) composition.Node {
	return composition.Node{Path: name, Dir: true}
}

func leaf(name string) composition.Node {
	return composition.Node{Path: name, Size: 1}
}

func TestPatchFilesTakeThePlacesTheGameAlreadyHas(t *testing.T) {
	game := []composition.Node{dir("Data"), leaf("Data/Script.pak"), leaf("Game.exe"), dir("Save"), leaf("readme.txt")}
	patch := []composition.Node{dir("data"), leaf("data/script.PAK"), leaf("data/new.pak"), dir("data/voice"), leaf("data/voice/a.ogg"), leaf("DATA/voice/b.ogg"), leaf("GAME.EXE"), dir("empty"), leaf("extra/note.txt"), leaf("Extra/second.txt")}
	moves, conflicts := composition.Overlay(game, patch)
	want := []composition.Move{
		{From: "data/script.PAK", To: "Data/Script.pak"},
		{From: "data/new.pak", To: "Data/new.pak"},
		{From: "data/voice/a.ogg", To: "Data/voice/a.ogg"},
		{From: "DATA/voice/b.ogg", To: "Data/voice/b.ogg"},
		{From: "GAME.EXE", To: "Game.exe"},
		{From: "extra/note.txt", To: "extra/note.txt"},
		{From: "Extra/second.txt", To: "extra/second.txt"},
	}
	if !slices.Equal(moves, want) || len(conflicts) != 0 {
		t.Fatalf("moves: %+v conflicts: %v", moves, conflicts)
	}
}

func TestAFileAndAFolderOfOneNameDoNotReplaceEachOther(t *testing.T) {
	game := []composition.Node{dir("Save"), leaf("config"), leaf("Game.exe")}
	moves, conflicts := composition.Overlay(game, []composition.Node{leaf("save"), leaf("config/inner.ini"), leaf("ok.txt")})
	if !slices.Equal(conflicts, []string{"save", "config/inner.ini"}) || !slices.Equal(moves, []composition.Move{{From: "ok.txt", To: "ok.txt"}}) {
		t.Fatalf("moves: %+v conflicts: %v", moves, conflicts)
	}
}

func TestFoldersAreFoundOnDiskWithoutRegardToCase(t *testing.T) {
	nodes := []composition.Node{dir("Wrap"), dir("Wrap/Game"), leaf("Wrap/Game/a.bin"), leaf("Wrap/readme.txt"), leaf("top.txt")}
	if got, ok := composition.Resolve(nodes, "wrap/game"); !ok || got != "Wrap/Game" {
		t.Fatalf("resolve: %q %v", got, ok)
	}
	if _, ok := composition.Resolve(nodes, "Wrap/readme.txt"); ok {
		t.Fatal("a file is not a folder")
	}
	if got, ok := composition.Resolve(nodes, composition.Root); !ok || got != composition.Root {
		t.Fatalf("the root: %q %v", got, ok)
	}
	if _, ok := composition.Resolve(nodes, "missing"); ok {
		t.Fatal("a folder that is not there")
	}
	inside := composition.Under(nodes, "WRAP")
	if !slices.Equal(inside, []composition.Node{dir("Game"), {Path: "Game/a.bin", Size: 1}, {Path: "readme.txt", Size: 1}}) {
		t.Fatalf("under: %+v", inside)
	}
	if tops := composition.Tops(nodes); !slices.Equal(tops, []composition.Node{dir("Wrap"), leaf("top.txt")}) {
		t.Fatalf("tops: %+v", tops)
	}
}
