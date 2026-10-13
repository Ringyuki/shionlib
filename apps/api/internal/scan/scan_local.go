package scan

import (
	"strings"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
)

type LocalFile struct {
	ResourceID int
	Name       string
	Path       string
	Size       int64
}

type LocalEntry struct {
	Path string
	Size int64
}

type LocalFinding struct {
	Status       download.CheckStatus
	Format       string
	Container    bool
	Encoding     string
	Files        []LocalEntry
	Unpacked     int64
	Viruses      []string
	Detections   []inspection.Detection
	SHA256       string
	InspectionID int
}

func (f LocalFinding) Infected() bool {
	return len(f.Viruses) > 0
}

func ownFiles(draft inspection.Draft) ([]LocalEntry, int64) {
	files := []LocalEntry{}
	var unpacked int64
	for _, entry := range draft.Entries {
		if entry.Kind == inspection.KindFolder || entry.Kind == inspection.KindTrack {
			continue
		}
		parts, plain := []string{entry.Name}, true
		for parent := entry.Parent; parent != inspection.TopLevel; parent = draft.Entries[parent].Parent {
			above := draft.Entries[parent]
			plain = plain && above.Kind == inspection.KindFolder
			parts = append([]string{above.Name}, parts...)
		}
		if !plain {
			continue
		}
		files = append(files, LocalEntry{Path: strings.Join(parts, nestedSeparator), Size: entry.Size})
		unpacked += entry.Size
	}
	return files, unpacked
}
