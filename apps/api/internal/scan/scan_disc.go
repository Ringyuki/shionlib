package scan

import (
	"path"
	"slices"
	"strings"
)

const (
	SignalAudio      = "audio"
	SignalSubchannel = "subchannel"
	SignalDPM        = "dpm"
	bootFolder       = "[BOOT]"
	audioSectorBytes = 2352
	framesPerSecond  = 75
)

var discExtensions = []string{"iso", "mdf", "nrg", "cdi", "mdx", "isz"}

var sheetOf = map[string][]string{
	"bin": {"cue"},
	"img": {"ccd", "cue"},
	"mdf": {"mds"},
	"iso": {"mds", "cue"},
}

type DiscVolume struct {
	Readable   bool
	Raw        bool
	Subchannel bool
	Format     string
	Label      string
	Bytes      int64
}

type DiscTrack struct {
	Number int
	Audio  bool
	Frames int64
}

func (t DiscTrack) Seconds() int {
	return int(t.Frames / framesPerSecond)
}

func (t DiscTrack) Bytes() int64 {
	return t.Frames * audioSectorBytes
}

type DiscSheet struct {
	Tracks []DiscTrack
	DPM    bool
}

type discCandidate struct {
	sheet string
	sub   bool
}

func withoutExtension(name string) string {
	return strings.TrimSuffix(name, path.Ext(name))
}

func discCandidates(entries []ArchiveEntry) map[int]discCandidate {
	byName := map[string]int{}
	for i, entry := range entries {
		if !entry.Folder {
			byName[strings.ToLower(cleanPath(entry.Path))] = i
		}
	}
	found := map[int]discCandidate{}
	for i, entry := range entries {
		if entry.Folder {
			continue
		}
		name := strings.ToLower(cleanPath(entry.Path))
		kind := extension(name)
		candidate := discCandidate{}
		for _, sheet := range sheetOf[kind] {
			if at, paired := byName[withoutExtension(name)+"."+sheet]; paired {
				candidate.sheet = entries[at].Path
				break
			}
		}
		if !slices.Contains(discExtensions, kind) && candidate.sheet == "" {
			continue
		}
		if at, paired := byName[withoutExtension(name)+".sub"]; paired && entries[at].Size > 0 {
			candidate.sub = true
		}
		found[i] = candidate
	}
	return found
}

func discSignals(volume DiscVolume, sheet DiscSheet, candidate discCandidate) []string {
	var signals []string
	if slices.ContainsFunc(sheet.Tracks, func(track DiscTrack) bool { return track.Audio }) {
		signals = append(signals, SignalAudio)
	}
	if volume.Subchannel || candidate.sub {
		signals = append(signals, SignalSubchannel)
	}
	if sheet.DPM {
		signals = append(signals, SignalDPM)
	}
	return signals
}

func withoutBoot(entries []ArchiveEntry) []ArchiveEntry {
	return slices.DeleteFunc(slices.Clone(entries), func(entry ArchiveEntry) bool {
		cleaned := cleanPath(entry.Path)
		return cleaned == bootFolder || strings.HasPrefix(cleaned, bootFolder+"/")
	})
}

func countListed(entries []ArchiveEntry) (int, int) {
	files, folders := 0, 0
	seen := map[string]bool{}
	for _, entry := range entries {
		cleaned := cleanPath(entry.Path)
		if entry.Folder {
			if !seen[cleaned] {
				seen[cleaned] = true
				folders++
			}
			continue
		}
		files++
		for dir, _ := splitPath(cleaned); dir != ""; dir, _ = splitPath(dir) {
			if !seen[dir] {
				seen[dir] = true
				folders++
			}
		}
	}
	return files, folders
}
