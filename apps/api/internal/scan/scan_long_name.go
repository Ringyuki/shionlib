package scan

import (
	"path"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
)

const (
	nameByteLimit = 255
	apartDir      = ".shionlib-apart"
)

type apartEntry struct {
	entry string
	file  string
}

func tooLongForTheDisk(name string) bool {
	for segment := range strings.SplitSeq(cleanPath(name), "/") {
		if len(segment) > nameByteLimit {
			return true
		}
	}
	return false
}

func (p *extraction) separate(entries []ArchiveEntry, limit int64) {
	for _, entry := range entries {
		if entry.Folder || !tooLongForTheDisk(entry.Path) {
			continue
		}
		scanned := Scanned(entry.Path) && entry.Size <= limit
		if !scanned && !slices.Contains(p.selection.Paths, entry.Path) {
			continue
		}
		original := cleanPath(entry.Path)
		file := apartDir + "/" + strconv.Itoa(len(p.apart)+1) + path.Ext(original)
		p.selection.Skip = append(p.selection.Skip, entry.Path)
		p.apart = append(p.apart, apartEntry{entry: entry.Path, file: file})
		p.aliases[file] = original
		for key, disc := range p.discs {
			if disc.sheetFile == original {
				disc.sheetFile = file
				p.discs[key] = disc
			}
		}
	}
}

func (p *extraction) key(relative string) string {
	key := cleanPath(filepath.ToSlash(relative))
	if original, aliased := p.aliases[key]; aliased {
		return original
	}
	return key
}
