package composition

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
)

func BaseOf(resource download.GameResource, facts map[int]inspection.Inspection, limit int64) (Base, *Unusable) {
	main := resource.MainFiles()
	base := Base{ResourceID: resource.ID, FileIDs: []int{}}
	for i, file := range main {
		if i == 0 {
			base.Name = file.Name
		}
		base.FileIDs = append(base.FileIDs, file.ID)
		base.Size += file.Size
	}
	if reason, unusable := unusable(resource, main, facts, limit); unusable {
		return base, &reason
	}
	fact := facts[*main[0].InspectionID]
	base.InspectionID = fact.ID
	base.Unpacked = fact.Totals.Size
	base.Encoding = fact.Archive.NameEncoding
	return base, nil
}

func unusable(resource download.GameResource, main []download.File, facts map[int]inspection.Inspection, limit int64) (Unusable, bool) {
	if len(main) == 0 || !resource.Published() {
		return UnusablePending, true
	}
	for _, file := range main {
		if file.Status != download.FileInObjectStore || file.CheckStatus != download.CheckOK || file.StorageKey == nil {
			return UnusablePending, true
		}
	}
	switch form := resource.Info.Form; {
	case form == nil:
		return UnusableUnknown, true
	case *form == download.FormDisc:
		return UnusableDisc, true
	case *form == download.FormInstaller:
		return UnusableInstaller, true
	}
	read := main[0].InspectionID
	for _, file := range main {
		if read == nil || file.InspectionID == nil || *file.InspectionID != *read {
			return UnusableUnread, true
		}
	}
	fact, found := facts[*read]
	switch {
	case !found:
		return UnusableUnread, true
	case fact.Status != inspection.StatusReady || fact.Archive.Unsupported:
		return UnusableUnreadable, true
	case fact.Truncated || fact.Totals.Size > limit:
		return UnusableTooLarge, true
	}
	return "", false
}

func Inspections(resources []download.GameResource) []int {
	ids := []int{}
	for _, resource := range resources {
		for _, file := range resource.MainFiles() {
			if file.InspectionID != nil {
				ids = append(ids, *file.InspectionID)
			}
		}
	}
	return ids
}
