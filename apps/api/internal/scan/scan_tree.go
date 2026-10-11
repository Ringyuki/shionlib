package scan

import (
	"path"
	"slices"
	"strings"

	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
)

const MaxNestingDepth = 3

var nestedArchiveExtensions = []string{"zip", "rar", "7z"}

var containerFormats = []string{"7z", "zip", "rar", "rar5", "tar", "gzip", "bzip2", "xz", "zstd", "lzma", "cab", "arj", "lzh", "wim", "cpio", "z", "iso", "udf"}

func Container(format string) bool {
	return slices.Contains(containerFormats, strings.ToLower(format))
}

func NestedArchive(name string) bool {
	if !slices.Contains(nestedArchiveExtensions, extension(name)) {
		return false
	}
	volume, numbered := ParseVolume(path.Base(name))
	return !numbered || volume.Scheme != SchemeRarParts || volume.Index == 1
}

func cleanPath(raw string) string {
	var kept []string
	for segment := range strings.SplitSeq(strings.ReplaceAll(raw, "\\", "/"), "/") {
		if segment != "" && segment != "." {
			kept = append(kept, segment)
		}
	}
	return strings.Join(kept, "/")
}

func splitPath(cleaned string) (string, string) {
	at := strings.LastIndexByte(cleaned, '/')
	if at < 0 {
		return "", cleaned
	}
	return cleaned[:at], cleaned[at+1:]
}

type planted struct {
	indexes []int
	paths   []string
}

func plantListing(draft *inspection.Draft, parent int, entries []ArchiveEntry, names []string) planted {
	folders := map[string]int{}
	var ensure func(dir string) int
	ensure = func(dir string) int {
		if dir == "" {
			return parent
		}
		if index, known := folders[dir]; known {
			return index
		}
		above, name := splitPath(dir)
		index := draft.Add(inspection.DraftEntry{Parent: ensure(above), Name: name, Kind: inspection.KindFolder})
		folders[dir] = index
		return index
	}
	out := planted{indexes: make([]int, len(entries)), paths: make([]string, len(entries))}
	for i, entry := range entries {
		shown := entry.Path
		if len(names) == len(entries) {
			shown = names[i]
		}
		cleaned := cleanPath(shown)
		out.indexes[i], out.paths[i] = inspection.TopLevel, cleaned
		if cleaned == "" {
			continue
		}
		if entry.Folder {
			index := ensure(cleaned)
			draft.Entries[index].Modified = entry.Modified
			out.indexes[i] = index
			continue
		}
		dir, name := splitPath(cleaned)
		out.indexes[i] = draft.Add(inspection.DraftEntry{
			Parent:    ensure(dir),
			Name:      name,
			Kind:      inspection.KindFile,
			Size:      entry.Size,
			Modified:  entry.Modified,
			Encrypted: entry.Encrypted,
		})
	}
	return out
}

func depthOf(cleaned string) int {
	return strings.Count(cleaned, "/")
}
