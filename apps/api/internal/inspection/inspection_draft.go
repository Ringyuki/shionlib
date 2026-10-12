package inspection

import (
	"cmp"
	"slices"
	"strings"
	"time"
	"unicode"
)

const TopLevel = -1

type Draft struct {
	ResourceID int
	Status     Status
	Archive    Archive
	Verified   bool
	Scan       Scan
	Entries    []DraftEntry
}

type DraftEntry struct {
	Parent     int
	Name       string
	Kind       Kind
	Size       int64
	Modified   *time.Time
	Encrypted  bool
	Unreadable bool
	Detail     Detail
}

func (d *Draft) Add(entry DraftEntry) int {
	entry.Name = ReadableText(entry.Name)
	d.Entries = append(d.Entries, entry)
	return len(d.Entries) - 1
}

func (d *Draft) AddTop(entry DraftEntry) int {
	entry.Parent = TopLevel
	return d.Add(entry)
}

type arrangement struct {
	totals    Totals
	truncated bool
	levels    [][]int
	entries   []NewEntry
}

func (d Draft) arrange() arrangement {
	count := len(d.Entries)
	entries := make([]NewEntry, count)
	depth := make([]int, count)
	inside := make([]int, count)
	for i, entry := range d.Entries {
		entries[i] = NewEntry{
			Name:       entry.Name,
			Kind:       entry.Kind,
			Size:       entry.Size,
			Modified:   entry.Modified,
			Encrypted:  entry.Encrypted,
			Unreadable: entry.Unreadable,
			Detail:     entry.Detail,
		}
		inside[i] = TopLevel
		if entry.Parent == TopLevel {
			continue
		}
		depth[i] = depth[entry.Parent] + 1
		inside[i] = inside[entry.Parent]
		if d.Entries[entry.Parent].Kind.Container() {
			inside[i] = entry.Parent
		}
	}
	var totals Totals
	folderSize := make([]int64, count)
	for i := count - 1; i >= 0; i-- {
		entry := d.Entries[i]
		if entry.Kind == KindFolder {
			entries[i].Size = folderSize[i]
		}
		if entry.Kind == KindDisc {
			totals.Discs++
			totals.DiscFiles += entries[i].Items
		}
		if inside[i] == TopLevel {
			if entry.Kind == KindFolder {
				totals.Folders++
			} else {
				totals.Files++
				totals.Size += entry.Size
			}
		}
		if entry.Parent == TopLevel {
			continue
		}
		entries[entry.Parent].Children++
		parent := d.Entries[entry.Parent]
		if entry.Kind == KindFolder {
			entries[entry.Parent].Items += entries[i].Items
			if parent.Kind == KindFolder {
				folderSize[entry.Parent] += folderSize[i]
			}
			continue
		}
		entries[entry.Parent].Items++
		if parent.Kind == KindFolder {
			folderSize[entry.Parent] += entry.Size
		}
	}
	kept := min(count, EntryLimit)
	position(d.Entries[:kept], entries[:kept])
	levels := [][]int{}
	for i := range kept {
		for len(levels) <= depth[i] {
			levels = append(levels, nil)
		}
		levels[depth[i]] = append(levels[depth[i]], i)
	}
	return arrangement{totals: totals, truncated: kept < count, levels: levels, entries: entries[:kept]}
}

func position(drafted []DraftEntry, entries []NewEntry) {
	siblings := map[int][]int{}
	for i, entry := range drafted {
		siblings[entry.Parent] = append(siblings[entry.Parent], i)
	}
	for _, group := range siblings {
		slices.SortStableFunc(group, func(a, b int) int {
			if byRank := cmp.Compare(rank(entries[a].Kind), rank(entries[b].Kind)); byRank != 0 {
				return byRank
			}
			return NaturalCompare(entries[a].Name, entries[b].Name)
		})
		for place, index := range group {
			entries[index].Position = place
		}
	}
}

func rank(kind Kind) int {
	switch kind {
	case KindFolder:
		return 0
	case KindTrack:
		return 2
	default:
		return 1
	}
}

func NaturalCompare(a, b string) int {
	left, right := []rune(strings.ToLower(a)), []rune(strings.ToLower(b))
	i, j := 0, 0
	for i < len(left) && j < len(right) {
		if unicode.IsDigit(left[i]) && unicode.IsDigit(right[j]) {
			startI, startJ := i, j
			for i < len(left) && unicode.IsDigit(left[i]) {
				i++
			}
			for j < len(right) && unicode.IsDigit(right[j]) {
				j++
			}
			if byNumber := compareDigits(left[startI:i], right[startJ:j]); byNumber != 0 {
				return byNumber
			}
			continue
		}
		if left[i] != right[j] {
			return cmp.Compare(left[i], right[j])
		}
		i++
		j++
	}
	if byLength := cmp.Compare(len(left)-i, len(right)-j); byLength != 0 {
		return byLength
	}
	return cmp.Compare(a, b)
}

func compareDigits(a, b []rune) int {
	trimmedA, trimmedB := trimZeros(a), trimZeros(b)
	if byLength := cmp.Compare(len(trimmedA), len(trimmedB)); byLength != 0 {
		return byLength
	}
	if byValue := slices.Compare(trimmedA, trimmedB); byValue != 0 {
		return byValue
	}
	return cmp.Compare(len(a), len(b))
}

func trimZeros(digits []rune) []rune {
	for len(digits) > 1 && digits[0] == '0' {
		digits = digits[1:]
	}
	return digits
}
