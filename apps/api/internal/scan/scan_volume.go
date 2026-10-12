package scan

import (
	"cmp"
	"slices"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
)

type Unit struct {
	Files   []PendingFile
	Scheme  download.VolumeScheme
	Missing []int
	Absent  []string
}

func (u Unit) Set() bool {
	return u.Scheme != ""
}

func (u Unit) Complete() bool {
	return len(u.Missing) == 0
}

func (u Unit) Entry() PendingFile {
	if u.Scheme == download.SchemeZipSplit {
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

func Units(files []PendingFile) []Unit {
	names := make([]string, len(files))
	for i, file := range files {
		names[i] = file.Name
	}
	sets := download.VolumeSets(names)
	units := make([]Unit, len(sets))
	for i, set := range sets {
		members := make([]PendingFile, len(set.Members))
		for j, position := range set.Members {
			members[j] = files[position]
		}
		units[i] = Unit{Files: members, Scheme: set.Scheme, Missing: set.Missing, Absent: set.Absent}
	}
	slices.SortStableFunc(units, func(a, b Unit) int { return cmp.Compare(a.Files[0].ID, b.Files[0].ID) })
	return units
}
