package scan

import (
	"cmp"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"
)

type VolumeScheme string

const (
	SchemeRarParts  VolumeScheme = "rar-parts"
	SchemeRarLegacy VolumeScheme = "rar-legacy"
	SchemeSplit     VolumeScheme = "split"
	SchemeZipSplit  VolumeScheme = "zip-split"
)

const lastVolume = -1

type Volume struct {
	Scheme VolumeScheme
	Base   string
	Index  int
}

var (
	rarPartName   = regexp.MustCompile(`(?i)^(.+)\.part0*(\d+)\.rar$`)
	rarLegacyName = regexp.MustCompile(`(?i)^(.+)\.r(\d{2,3})$`)
	rarFirstName  = regexp.MustCompile(`(?i)^(.+)\.rar$`)
	splitName     = regexp.MustCompile(`(?i)^(.+)\.(\d{3})$`)
	zipPartName   = regexp.MustCompile(`(?i)^(.+)\.z(\d{2,3})$`)
	zipLastName   = regexp.MustCompile(`(?i)^(.+)\.zip$`)
)

func ParseVolume(name string) (Volume, bool) {
	match := func(pattern *regexp.Regexp) (string, int, bool) {
		groups := pattern.FindStringSubmatch(name)
		if groups == nil {
			return "", 0, false
		}
		if len(groups) < 3 {
			return strings.ToLower(groups[1]), 0, true
		}
		number, err := strconv.Atoi(groups[2])
		return strings.ToLower(groups[1]), number, err == nil
	}
	if base, n, ok := match(rarPartName); ok && n > 0 {
		return Volume{Scheme: SchemeRarParts, Base: base, Index: n}, true
	}
	if base, n, ok := match(rarLegacyName); ok {
		return Volume{Scheme: SchemeRarLegacy, Base: base, Index: n + 2}, true
	}
	if base, _, ok := match(rarFirstName); ok {
		return Volume{Scheme: SchemeRarLegacy, Base: base, Index: 1}, true
	}
	if base, n, ok := match(zipPartName); ok && n > 0 {
		return Volume{Scheme: SchemeZipSplit, Base: base, Index: n}, true
	}
	if base, _, ok := match(zipLastName); ok {
		return Volume{Scheme: SchemeZipSplit, Base: base, Index: lastVolume}, true
	}
	if base, n, ok := match(splitName); ok && n > 0 {
		return Volume{Scheme: SchemeSplit, Base: base, Index: n}, true
	}
	return Volume{}, false
}

type Unit struct {
	Files   []PendingFile
	Scheme  VolumeScheme
	Missing []int
}

func (u Unit) Set() bool {
	return u.Scheme != ""
}

func (u Unit) Complete() bool {
	return len(u.Missing) == 0
}

func (u Unit) Entry() PendingFile {
	if u.Scheme == SchemeZipSplit {
		return u.Files[len(u.Files)-1]
	}
	return u.Files[0]
}

func (u Unit) Oldest() time.Time {
	oldest := u.Files[0].Created
	for _, file := range u.Files[1:] {
		if file.Created.Before(oldest) {
			oldest = file.Created
		}
	}
	return oldest
}

func (u Unit) Names() []string {
	names := make([]string, len(u.Files))
	for i, file := range u.Files {
		names[i] = file.Name
	}
	return names
}

type volumeKey struct {
	scheme VolumeScheme
	base   string
}

type member struct {
	file  PendingFile
	index int
}

func Units(files []PendingFile) []Unit {
	groups := map[volumeKey][]member{}
	var order []volumeKey
	var units []Unit
	for _, file := range files {
		volume, ok := ParseVolume(file.Name)
		if !ok {
			units = append(units, Unit{Files: []PendingFile{file}})
			continue
		}
		key := volumeKey{volume.Scheme, volume.Base}
		if _, seen := groups[key]; !seen {
			order = append(order, key)
		}
		groups[key] = append(groups[key], member{file: file, index: volume.Index})
	}
	for _, key := range order {
		members := groups[key]
		if standalone(key.scheme, members) {
			units = append(units, Unit{Files: []PendingFile{members[0].file}})
			continue
		}
		units = append(units, volumeSet(key.scheme, members))
	}
	slices.SortStableFunc(units, func(a, b Unit) int { return cmp.Compare(a.Files[0].ID, b.Files[0].ID) })
	return units
}

func standalone(scheme VolumeScheme, members []member) bool {
	if len(members) != 1 {
		return false
	}
	switch scheme {
	case SchemeRarLegacy:
		return members[0].index == 1
	case SchemeZipSplit:
		return members[0].index == lastVolume
	default:
		return false
	}
}

func volumeSet(scheme VolumeScheme, members []member) Unit {
	hasLast := false
	highest := 0
	present := map[int]bool{}
	for _, m := range members {
		if m.index == lastVolume {
			hasLast = true
			continue
		}
		present[m.index] = true
		highest = max(highest, m.index)
	}
	var missing []int
	for index := 1; index <= highest; index++ {
		if !present[index] {
			missing = append(missing, index)
		}
	}
	if scheme == SchemeZipSplit && !hasLast {
		missing = append(missing, highest+1)
	}
	slices.SortStableFunc(members, func(a, b member) int {
		return cmp.Compare(order(a.index), order(b.index))
	})
	files := make([]PendingFile, len(members))
	for i, m := range members {
		files[i] = m.file
	}
	return Unit{Files: files, Scheme: scheme, Missing: missing}
}

func order(index int) int {
	if index == lastVolume {
		return int(^uint(0) >> 1)
	}
	return index
}
