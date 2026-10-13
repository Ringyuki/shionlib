package scan_test

import (
	"strings"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
)

type holding struct {
	path string
	size int64
	kind inspection.Kind
}

func stored(path string, size int64) holding {
	return holding{path: path, size: size, kind: inspection.KindFile}
}

func draftOf(entries ...holding) inspection.Draft {
	var draft inspection.Draft
	folders := map[string]int{}
	var folderOf func(path string) int
	folderOf = func(path string) int {
		if path == "" {
			return inspection.TopLevel
		}
		if index, ok := folders[path]; ok {
			return index
		}
		parent, name := "", path
		if cut := strings.LastIndex(path, "/"); cut >= 0 {
			parent, name = path[:cut], path[cut+1:]
		}
		index := draft.Add(inspection.DraftEntry{Parent: folderOf(parent), Name: name, Kind: inspection.KindFolder})
		folders[path] = index
		return index
	}
	for _, entry := range entries {
		parent, name := "", entry.path
		if cut := strings.LastIndex(entry.path, "/"); cut >= 0 {
			parent, name = entry.path[:cut], entry.path[cut+1:]
		}
		index := draft.Add(inspection.DraftEntry{Parent: folderOf(parent), Name: name, Kind: entry.kind, Size: entry.size})
		if entry.kind == inspection.KindFolder {
			folders[entry.path] = index
		}
	}
	return draft
}

func TestReadFormTellsHowAGameIsDelivered(t *testing.T) {
	const mib = 1 << 20
	cases := []struct {
		name    string
		draft   inspection.Draft
		form    download.Form
		decided bool
	}{
		{"a disc image inside", draftOf(stored("Game/setup.exe", mib), holding{path: "Game/GAME.mdf", size: 900 * mib, kind: inspection.KindDisc}), download.FormDisc, true},
		{"an installed folder with its uninstaller beside a setup tool", draftOf(
			stored("Game/AdvHD.exe", 3*mib), stored("Game/setup.exe", mib), stored("Game/uninst.exe", mib), stored("Game/Bgm.arc", 600*mib),
			stored("Game/DirectX/DXSETUP.exe", mib), stored("Game/DirectX/Apr2005_d3dx9_25_x86.cab", 2*mib)), download.FormPortable, true},
		{"a folder left by the Wise installer", draftOf(stored("EVE/Evezero.exe", mib), stored("EVE/Setup.exe", mib), stored("EVE/Unwise.exe", mib), stored("EVE/evezeroh.ac3", 1200*mib)), download.FormPortable, true},
		{"an Inno Setup installer with its slices", draftOf(stored("Game/setup.exe", mib), stored("Game/setup-1.bin", 475*mib), stored("Game/setup-2.bin", 371*mib), stored("Game/readme.txt", 1)), download.FormInstaller, true},
		{"an InstallShield installer", draftOf(stored("DISK/setup.exe", mib), stored("DISK/data1.hdr", mib), stored("DISK/data1.cab", 2000*mib), stored("DISK/game.ico", 1)), download.FormInstaller, true},
		{"a single installer program", draftOf(stored("Game/Install.exe", 3000*mib), stored("Game/manual.pdf", 2*mib)), download.FormInstaller, true},
		{"an installer that ships its parts as programs", draftOf(stored("Setup.exe", mib), stored("bin/update01.exe", 672*mib), stored("bin/update02.exe", 672*mib), stored("はじめにお読みください.txt", 1)), download.FormInstaller, true},
		{"game data in bin files beside the game", draftOf(stored("Game/graph_vis.bin", 1484*mib), stored("Game/voice.bin", 489*mib), stored("Game/AstralAirFinale.exe", 4*mib)), download.FormPortable, true},
		{"a game with a configuration tool named setup", draftOf(stored("Game/kakehana.exe", 2*mib), stored("Game/Setup.exe", mib), stored("Game/Setup.dat", 1), stored("Game/data.xp3", 900*mib)), download.FormPortable, true},
		{"the game's own folder holding a support folder of programs", draftOf(stored("Game/Support/vc_redist.x86.exe", 14*mib), stored("Game/data.xp3", 700*mib)), "", false},
		{"no program at all", draftOf(stored("Game/data.xp3", 599*mib), stored("Game/savedata/data0.bmp", 1)), "", false},
		{"mostly an archive that could not be opened", draftOf(stored("Game/launcher.exe", mib), holding{path: "Game/game.7z", size: 3000 * mib, kind: inspection.KindArchive}), "", false},
		{"nothing inside", inspection.Draft{}, "", false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			form, decided := scan.ReadForm(c.draft)
			if form != c.form || decided != c.decided {
				t.Fatalf("read %q %v, want %q %v", form, decided, c.form, c.decided)
			}
		})
	}
}

func TestReadFormLooksInsideOpenedArchives(t *testing.T) {
	draft := draftOf(holding{path: "Game.zip", size: 900 << 20, kind: inspection.KindArchive})
	draft.Add(inspection.DraftEntry{Parent: 0, Name: "Game.exe", Kind: inspection.KindFile, Size: 2 << 20})
	draft.Add(inspection.DraftEntry{Parent: 0, Name: "data.xp3", Kind: inspection.KindFile, Size: 950 << 20})
	if form, decided := scan.ReadForm(draft); form != download.FormPortable || !decided {
		t.Fatalf("the files of an opened archive decide: %q %v", form, decided)
	}
}
