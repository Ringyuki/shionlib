package inspectionpg

import (
	"encoding/json"
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
)

type detectionRow struct {
	Path      string `json:"path"`
	Signature string `json:"signature"`
}

type detailRow struct {
	Format  string   `json:"format,omitempty"`
	Label   string   `json:"label,omitempty"`
	Files   int      `json:"files,omitempty"`
	Folders int      `json:"folders,omitempty"`
	Track   int      `json:"track,omitempty"`
	Seconds int      `json:"seconds,omitempty"`
	Signals []string `json:"signals,omitempty"`
}

func encodeDetections(detections []inspection.Detection) (json.RawMessage, error) {
	if len(detections) == 0 {
		return nil, nil
	}
	rows := make([]detectionRow, len(detections))
	for i, detection := range detections {
		rows[i] = detectionRow{Path: detection.Path, Signature: detection.Signature}
	}
	return json.Marshal(rows)
}

func encodeDetail(detail inspection.Detail) (json.RawMessage, error) {
	if detail.Empty() {
		return nil, nil
	}
	return json.Marshal(detailRow{
		Format:  detail.Format,
		Label:   detail.Label,
		Files:   detail.Files,
		Folders: detail.Folders,
		Track:   detail.Track,
		Seconds: detail.Seconds,
		Signals: detail.Signals,
	})
}

func toInspection(row *ent.Inspection) (inspection.Inspection, error) {
	var stored []detectionRow
	if len(row.Detections) > 0 {
		if err := json.Unmarshal(row.Detections, &stored); err != nil {
			return inspection.Inspection{}, fmt.Errorf("decode detections of inspection %d: %w", row.ID, err)
		}
	}
	detections := make([]inspection.Detection, len(stored))
	for i, detection := range stored {
		detections[i] = inspection.Detection{Path: detection.Path, Signature: detection.Signature}
	}
	skipped := []string(row.ScanSkipped)
	if skipped == nil {
		skipped = []string{}
	}
	return inspection.Inspection{
		ID:         row.ID,
		ResourceID: row.ResourceID,
		Status:     inspection.Status(row.Status),
		Archive: inspection.Archive{
			Format:          row.ArchiveFormat,
			Solid:           row.Solid,
			Volumes:         row.Volumes,
			Recovery:        row.Recovery,
			RecoveryPercent: row.RecoveryPercent,
			NameEncoding:    row.NameEncoding,
			Unsupported:     row.UnsupportedMethod,
		},
		Totals: inspection.Totals{
			Files:     row.FileCount,
			Folders:   row.FolderCount,
			Size:      row.UnpackedSize,
			Discs:     row.DiscCount,
			DiscFiles: row.DiscFileCount,
		},
		Truncated: row.Truncated,
		Verified:  row.Verified,
		Scan: inspection.Scan{
			Engine:       row.ScanEngine,
			SignaturesAt: row.SignaturesAt,
			Scanned:      row.ScannedCount,
			Skipped:      skipped,
			Limit:        row.ScanLimit,
			Detections:   detections,
			At:           row.ScannedAt,
			ClearedAt:    row.ClearedAt,
		},
		Created: row.Created,
	}, nil
}

func toEntry(row *ent.InspectionEntry) (inspection.Entry, error) {
	var stored detailRow
	if len(row.Detail) > 0 {
		if err := json.Unmarshal(row.Detail, &stored); err != nil {
			return inspection.Entry{}, fmt.Errorf("decode detail of inspection entry %d: %w", row.ID, err)
		}
	}
	return inspection.Entry{
		ID:           row.ID,
		InspectionID: row.InspectionID,
		ParentID:     row.ParentID,
		Name:         row.Name,
		Kind:         inspection.Kind(row.Kind),
		Size:         row.Size,
		Modified:     row.Modified,
		Items:        row.Items,
		Children:     row.Children,
		Encrypted:    row.Encrypted,
		Unreadable:   row.Unreadable,
		Preview:      inspection.Preview(row.Preview),
		Detail: inspection.Detail{
			Format:  stored.Format,
			Label:   stored.Label,
			Files:   stored.Files,
			Folders: stored.Folders,
			Track:   stored.Track,
			Seconds: stored.Seconds,
			Signals: stored.Signals,
		},
	}, nil
}

func toEntries(rows []*ent.InspectionEntry) ([]inspection.Entry, error) {
	entries := make([]inspection.Entry, len(rows))
	for i, row := range rows {
		entry, err := toEntry(row)
		if err != nil {
			return nil, err
		}
		entries[i] = entry
	}
	return entries, nil
}
