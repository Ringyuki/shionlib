package downloadpg

import (
	"encoding/json"
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/userpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/translator"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

func toResource(row *ent.GameDownloadResource) download.Resource {
	resource := download.Resource{
		ID:          row.ID,
		GameID:      row.GameID,
		Status:      row.Status,
		Platforms:   nonNilStrings(row.Platform),
		Languages:   nonNilStrings(row.Language),
		Note:        row.Note,
		Info:        toInfo(row),
		Canonical:   row.CanonicalName,
		Downloads:   row.Downloads,
		PublishedAt: row.PublishedAt,
		CreatorID:   row.CreatorID,
		Created:     row.Created,
		Updated:     row.Updated,
	}
	if row.Simulator != nil {
		simulator := string(*row.Simulator)
		resource.Simulator = &simulator
	}
	return resource
}

func toInfo(row *ent.GameDownloadResource) download.Info {
	info := download.Info{
		Translators:  make([]translator.Ref, 0, len(row.Edges.TranslatorCredits)),
		PatchVersion: row.PatchVersion,
		ReleaseURL:   row.ReleaseURL,
		EditionName:  row.EditionName,
		Extras:       nonNilStrings(row.Extras),
	}
	if row.Translation != nil {
		translation := download.Translation(*row.Translation)
		info.Translation = &translation
	}
	if row.Edition != nil {
		edition := download.Edition(*row.Edition)
		info.Edition = &edition
	}
	if row.Form != nil {
		form := download.Form(*row.Form)
		info.Form = &form
	}
	for _, credit := range row.Edges.TranslatorCredits {
		if credit.Edges.Translator != nil {
			info.Translators = append(info.Translators, translator.Ref{ID: credit.Edges.Translator.ID, Name: credit.Edges.Translator.Name})
		}
	}
	return info
}

func toFiles(rows []*ent.GameDownloadResourceFile) []download.File {
	files := make([]download.File, len(rows))
	for i, row := range rows {
		files[i] = toFile(row, row.Edges.GameDownloadResource)
	}
	return files
}

func toFile(row *ent.GameDownloadResourceFile, resource *ent.GameDownloadResource) download.File {
	file := download.File{
		ID:              row.ID,
		ResourceID:      row.GameDownloadResourceID,
		Type:            row.Type,
		Name:            row.FileName,
		OriginalName:    row.OriginalName,
		Path:            row.FilePath,
		Size:            row.FileSize,
		URL:             row.FileURL,
		StorageKey:      row.S3FileKey,
		ContentType:     row.FileContentType,
		HashAlgorithm:   upload.HashAlgorithm(row.HashAlgorithm),
		Hash:            row.FileHash,
		UploadSessionID: row.UploadSessionID,
		Status:          row.FileStatus,
		CheckStatus:     download.CheckStatus(row.FileCheckStatus),
		FalsePositive:   row.IsVirusFalsePositive,
		SHA256:          row.FileSha256,
		InspectionID:    row.InspectionID,
		CreatorID:       row.CreatorID,
		Created:         row.Created,
		Updated:         row.Updated,
	}
	if resource != nil {
		file.GameID = resource.GameID
		file.ResourceStatus = resource.Status
	}
	return file
}

func toHistory(row *ent.GameDownloadResourceFileHistory) download.History {
	return download.History{
		ID:              row.ID,
		FileID:          row.FileID,
		Size:            row.FileSize,
		HashAlgorithm:   upload.HashAlgorithm(row.HashAlgorithm),
		Hash:            row.FileHash,
		StorageKey:      row.S3FileKey,
		Reason:          row.Reason,
		UploadSessionID: row.UploadSessionID,
		OperatorID:      row.OperatorID,
		Created:         row.Created,
	}
}

type eventFileRow struct {
	Name string `json:"name"`
	Size int64  `json:"size"`
}

type fieldChangeRow struct {
	Field string   `json:"field"`
	Old   []string `json:"old"`
	New   []string `json:"new"`
}

type eventRow struct {
	Files   []eventFileRow   `json:"files,omitempty"`
	Name    string           `json:"name,omitempty"`
	OldName string           `json:"old_name,omitempty"`
	Reason  *string          `json:"reason,omitempty"`
	OldSize *int64           `json:"old_size,omitempty"`
	NewSize *int64           `json:"new_size,omitempty"`
	Changes []fieldChangeRow `json:"changes,omitempty"`
}

func toEventRow(data download.EventData) eventRow {
	row := eventRow{Name: data.Name, OldName: data.OldName, OldSize: data.OldSize, NewSize: data.NewSize}
	if data.Reason != nil && *data.Reason != "" {
		row.Reason = data.Reason
	}
	for _, file := range data.Files {
		row.Files = append(row.Files, eventFileRow{Name: file.Name, Size: file.Size})
	}
	for _, change := range data.Changes {
		row.Changes = append(row.Changes, fieldChangeRow{Field: string(change.Field), Old: nonNilStrings(change.Old), New: nonNilStrings(change.New)})
	}
	return row
}

func toEvent(row *ent.GameDownloadResourceEvent) (download.Event, error) {
	var stored eventRow
	if len(row.Data) > 0 {
		if err := json.Unmarshal(row.Data, &stored); err != nil {
			return download.Event{}, fmt.Errorf("decode event %d of download resource %d: %w", row.ID, row.ResourceID, err)
		}
	}
	data := download.EventData{Name: stored.Name, OldName: stored.OldName, Reason: stored.Reason, OldSize: stored.OldSize, NewSize: stored.NewSize}
	for _, file := range stored.Files {
		data.Files = append(data.Files, download.EventFile{Name: file.Name, Size: file.Size})
	}
	for _, change := range stored.Changes {
		data.Changes = append(data.Changes, download.FieldChange{Field: download.EventField(change.Field), Old: nonNilStrings(change.Old), New: nonNilStrings(change.New)})
	}
	return download.Event{
		ID:         row.ID,
		ResourceID: row.ResourceID,
		Kind:       download.EventKind(row.Kind),
		Actor:      userpg.ToSummaryPtr(row.Edges.Actor),
		Data:       data,
		Created:    row.Created,
	}, nil
}
