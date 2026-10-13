package download

import (
	"cmp"
	"fmt"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode"
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
	rarPartShape  = regexp.MustCompile(`(?i)^(.+\.part)(\d+)(\.rar)$`)
	numberedShape = regexp.MustCompile(`^(.+\.[A-Za-z]?)(\d+)$`)
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

type VolumeSet struct {
	Scheme  VolumeScheme
	Members []int
	Missing []int
	Absent  []string
}

func (s VolumeSet) Set() bool {
	return s.Scheme != ""
}

type volumeKey struct {
	scheme VolumeScheme
	base   string
}

type volumeMember struct {
	position int
	index    int
}

func VolumeSets(names []string) []VolumeSet {
	groups := map[volumeKey][]volumeMember{}
	var order []volumeKey
	var sets []VolumeSet
	for position, name := range names {
		volume, ok := ParseVolume(name)
		if !ok {
			sets = append(sets, VolumeSet{Members: []int{position}})
			continue
		}
		key := volumeKey{volume.Scheme, volume.Base}
		if _, seen := groups[key]; !seen {
			order = append(order, key)
		}
		groups[key] = append(groups[key], volumeMember{position: position, index: volume.Index})
	}
	for _, key := range order {
		members := groups[key]
		if standalone(key.scheme, members) {
			sets = append(sets, VolumeSet{Members: []int{members[0].position}})
			continue
		}
		sets = append(sets, volumeSet(key.scheme, members, names))
	}
	slices.SortStableFunc(sets, func(a, b VolumeSet) int {
		return cmp.Compare(slices.Min(a.Members), slices.Min(b.Members))
	})
	return sets
}

func standalone(scheme VolumeScheme, members []volumeMember) bool {
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

func volumeSet(scheme VolumeScheme, members []volumeMember, names []string) VolumeSet {
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
	slices.SortStableFunc(members, func(a, b volumeMember) int {
		return cmp.Compare(volumeRank(a.index), volumeRank(b.index))
	})
	set := VolumeSet{Scheme: scheme, Members: make([]int, len(members))}
	for i, m := range members {
		set.Members[i] = m.position
	}
	sibling := names[members[0].position]
	for index := 1; index <= highest; index++ {
		if !present[index] {
			set.Missing = append(set.Missing, index)
			set.Absent = append(set.Absent, absentVolume(scheme, sibling, index))
		}
	}
	if scheme == SchemeZipSplit && !hasLast {
		set.Missing = append(set.Missing, highest+1)
		set.Absent = append(set.Absent, absentVolume(scheme, sibling, lastVolume))
	}
	return set
}

func volumeRank(index int) int {
	if index == lastVolume {
		return int(^uint(0) >> 1)
	}
	return index
}

func absentVolume(scheme VolumeScheme, sibling string, index int) string {
	if scheme == SchemeRarParts {
		shape := rarPartShape.FindStringSubmatch(sibling)
		return fmt.Sprintf("%s%0*d%s", shape[1], len(shape[2]), index, shape[3])
	}
	stem := sibling[:strings.LastIndex(sibling, ".")]
	width := 0
	if shape := numberedShape.FindStringSubmatch(sibling); shape != nil {
		width = len(shape[2])
	}
	var extension string
	switch {
	case scheme == SchemeRarLegacy && index == 1:
		extension = ".rar"
	case scheme == SchemeRarLegacy:
		extension = fmt.Sprintf(".r%0*d", max(width, 2), index-2)
	case scheme == SchemeZipSplit && index == lastVolume:
		extension = ".zip"
	case scheme == SchemeZipSplit:
		extension = fmt.Sprintf(".z%0*d", max(width, 2), index)
	default:
		extension = fmt.Sprintf(".%0*d", max(width, 3), index)
	}
	if shouting(sibling[len(stem):]) {
		extension = strings.ToUpper(extension)
	}
	return stem + extension
}

func shouting(extension string) bool {
	letters := false
	for _, r := range extension {
		if unicode.IsLower(r) {
			return false
		}
		letters = letters || unicode.IsUpper(r)
	}
	return letters
}

func Arranged[T any](items []T, name func(T) string) []T {
	names := make([]string, len(items))
	for i, item := range items {
		names[i] = name(item)
	}
	arranged := make([]T, 0, len(items))
	for _, set := range VolumeSets(names) {
		for _, position := range set.Members {
			arranged = append(arranged, items[position])
		}
	}
	return arranged
}

type AwaitedVolumes struct {
	FileIDs  []int
	Names    []string
	Deadline time.Time
}

func (r GameResource) awaiting(timeout time.Duration) *AwaitedVolumes {
	var pending []GameFile
	for _, file := range r.Files {
		if file.Stage() == StageChecking {
			pending = append(pending, file)
		}
	}
	names := make([]string, len(pending))
	for i, file := range pending {
		names[i] = file.Name
	}
	var awaited AwaitedVolumes
	for _, set := range VolumeSets(names) {
		if len(set.Absent) == 0 {
			continue
		}
		awaited.Names = append(awaited.Names, set.Absent...)
		for _, position := range set.Members {
			file := pending[position]
			awaited.FileIDs = append(awaited.FileIDs, file.ID)
			if due := file.Created.Add(timeout); awaited.Deadline.IsZero() || due.Before(awaited.Deadline) {
				awaited.Deadline = due
			}
		}
	}
	if len(awaited.Names) == 0 {
		return nil
	}
	return &awaited
}

func (r GameResource) StageOf(file GameFile) Stage {
	stage := file.Stage()
	if stage == StageChecking && r.Awaited != nil && slices.Contains(r.Awaited.FileIDs, file.ID) {
		return StageAwaitingVolumes
	}
	return stage
}
