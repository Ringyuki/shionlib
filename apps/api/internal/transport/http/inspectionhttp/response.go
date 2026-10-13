package inspectionhttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
)

type inspectionArchiveDTO struct {
	Format          string `json:"format" doc:"The container format as 7-Zip names it, in lower case (zip, rar, rar5, 7z, iso); empty when the file is not an archive"`
	Solid           bool   `json:"solid"`
	Volumes         int    `json:"volumes" doc:"How many volumes the archive is split into; 0 or 1 for a single file"`
	Recovery        bool   `json:"recovery" doc:"Whether the archive carries a recovery record"`
	RecoveryPercent int    `json:"recovery_percent" doc:"Size of the recovery record relative to the data, in percent; 0 when the format does not tell"`
	NameEncoding    string `json:"name_encoding" doc:"The legacy encoding its file names were stored in (shift_jis, gbk, big5); empty when they are Unicode"`
	Unsupported     bool   `json:"unsupported" doc:"7-Zip cannot unpack the compression method the archive uses: what it holds is listed, but was neither tested nor scanned"`
}

type inspectionDetectionDTO struct {
	Path      string `json:"path"`
	Signature string `json:"signature"`
}

type inspectionScanDTO struct {
	Engine       string                   `json:"engine" doc:"Name and version of the virus scanner; empty when the file was not scanned"`
	SignaturesAt *time.Time               `json:"signatures_at" doc:"When the scanner's signatures were last updated"`
	Scanned      int                      `json:"scanned" doc:"How many executables and scripts were scanned, nested archives and disc images included"`
	Skipped      []string                 `json:"skipped" doc:"Paths left unscanned because they exceed the limit"`
	Limit        int64                    `json:"limit" doc:"The largest file the scanner takes, in bytes"`
	Detections   []inspectionDetectionDTO `json:"detections"`
	At           *time.Time               `json:"at"`
	ClearedAt    *time.Time               `json:"cleared_at" doc:"When a reviewer released the file after a detection"`
}

type inspectionDiscDTO struct {
	EntryID    int      `json:"entry_id"`
	Name       string   `json:"name"`
	Size       int64    `json:"size"`
	Format     string   `json:"format" doc:"The file system that was read (iso9660, iso9660+joliet, udf); empty when the image could not be read"`
	Label      string   `json:"label"`
	Files      int      `json:"files"`
	Folders    int      `json:"folders"`
	Unreadable bool     `json:"unreadable"`
	Signals    []string `json:"signals" doc:"What the image shows about how the disc is meant to be used"`
}

type inspectionDTO struct {
	ID        int                  `json:"id"`
	Status    inspection.Status    `json:"status" enum:"ready,plain,failed" doc:"ready: the contents were read; plain: the file is not an archive; failed: the contents could not be read"`
	Archive   inspectionArchiveDTO `json:"archive"`
	Files     int                  `json:"files" doc:"Files the archive holds, not counting what is inside nested archives and disc images"`
	Folders   int                  `json:"folders"`
	Size      int64                `json:"size" doc:"Size of those files once unpacked, in bytes"`
	DiscFiles int                  `json:"disc_files" doc:"Files inside the disc images the archive holds"`
	Truncated bool                 `json:"truncated" doc:"Whether the listing was cut at the entry limit"`
	Verified  bool                 `json:"verified" doc:"Whether the archive passed the integrity test"`
	Scan      inspectionScanDTO    `json:"scan"`
	Discs     []inspectionDiscDTO  `json:"discs"`
	Created   time.Time            `json:"created"`
}

type inspectionTrackDTO struct {
	Number  int `json:"number"`
	Seconds int `json:"seconds"`
}

type inspectionEntryDTO struct {
	ID         int                 `json:"id"`
	ParentID   *int                `json:"parent_id"`
	Name       string              `json:"name"`
	Kind       inspection.Kind     `json:"kind" enum:"folder,file,archive,disc,track"`
	Size       int64               `json:"size" doc:"Bytes; for a folder, the sum of the files below it"`
	Modified   *time.Time          `json:"modified"`
	Items      int                 `json:"items" doc:"Files below a folder, or inside an archive or disc image"`
	Children   int                 `json:"children" doc:"Entries directly inside"`
	Encrypted  bool                `json:"encrypted"`
	Unreadable bool                `json:"unreadable" doc:"A nested archive or disc image whose contents could not be read"`
	Preview    *inspection.Preview `json:"preview" enum:"text,image" doc:"The kind of preview kept for the file; null when there is none"`
	Track      *inspectionTrackDTO `json:"track" doc:"Set for an audio track of a disc image"`
}

type inspectionFoundDTO struct {
	ID         int                 `json:"id"`
	ParentID   *int                `json:"parent_id"`
	Name       string              `json:"name"`
	Kind       inspection.Kind     `json:"kind" enum:"folder,file,archive,disc,track"`
	Size       int64               `json:"size"`
	Modified   *time.Time          `json:"modified"`
	Items      int                 `json:"items"`
	Children   int                 `json:"children"`
	Encrypted  bool                `json:"encrypted"`
	Unreadable bool                `json:"unreadable"`
	Preview    *inspection.Preview `json:"preview" enum:"text,image"`
	Track      *inspectionTrackDTO `json:"track"`
	Location   string              `json:"location" doc:"Path of the folder that holds the file; empty at the top level"`
}

type inspectionTextDTO struct {
	ID       int                 `json:"id"`
	Name     string              `json:"name"`
	Size     int64               `json:"size"`
	Encoding inspection.Encoding `json:"encoding" enum:"utf-8,utf-16le,utf-16be,shift_jis,gbk,big5,euc-jp" doc:"The encoding the bytes look like, as a TextDecoder label"`
	Content  []byte              `json:"content" doc:"The bytes of the file as they are, base64-encoded"`
}

type inspectionImageDTO struct {
	ContentType     string `header:"Content-Type"`
	CacheControl    string `header:"Cache-Control"`
	ContentTypeOpts string `header:"X-Content-Type-Options"`
	ContentPolicy   string `header:"Content-Security-Policy"`
	Body            []byte
}

func nonNil[T any](items []T) []T {
	if items == nil {
		return []T{}
	}
	return items
}

func toInspectionDTO(view inspection.View) inspectionDTO {
	detections := make([]inspectionDetectionDTO, len(view.Scan.Detections))
	for i, detection := range view.Scan.Detections {
		detections[i] = inspectionDetectionDTO{Path: detection.Path, Signature: detection.Signature}
	}
	discs := make([]inspectionDiscDTO, len(view.Discs))
	for i, disc := range view.Discs {
		discs[i] = inspectionDiscDTO{
			EntryID:    disc.ID,
			Name:       disc.Name,
			Size:       disc.Size,
			Format:     disc.Detail.Format,
			Label:      disc.Detail.Label,
			Files:      disc.Detail.Files,
			Folders:    disc.Detail.Folders,
			Unreadable: disc.Unreadable,
			Signals:    nonNil(disc.Detail.Signals),
		}
	}
	return inspectionDTO{
		ID:     view.ID,
		Status: view.Status,
		Archive: inspectionArchiveDTO{
			Format:          view.Archive.Format,
			Solid:           view.Archive.Solid,
			Volumes:         view.Archive.Volumes,
			Recovery:        view.Archive.Recovery,
			RecoveryPercent: view.Archive.RecoveryPercent,
			NameEncoding:    view.Archive.NameEncoding,
			Unsupported:     view.Archive.Unsupported,
		},
		Files:     view.Totals.Files,
		Folders:   view.Totals.Folders,
		Size:      view.Totals.Size,
		DiscFiles: view.Totals.DiscFiles,
		Truncated: view.Truncated,
		Verified:  view.Verified,
		Scan: inspectionScanDTO{
			Engine:       view.Scan.Engine,
			SignaturesAt: view.Scan.SignaturesAt,
			Scanned:      view.Scan.Scanned,
			Skipped:      nonNil(view.Scan.Skipped),
			Limit:        view.Scan.Limit,
			Detections:   detections,
			At:           view.Scan.At,
			ClearedAt:    view.Scan.ClearedAt,
		},
		Discs:   discs,
		Created: view.Created,
	}
}

func toEntryDTO(entry inspection.Entry) inspectionEntryDTO {
	dto := inspectionEntryDTO{
		ID:         entry.ID,
		ParentID:   entry.ParentID,
		Name:       entry.Name,
		Kind:       entry.Kind,
		Size:       entry.Size,
		Modified:   entry.Modified,
		Items:      entry.Items,
		Children:   entry.Children,
		Encrypted:  entry.Encrypted,
		Unreadable: entry.Unreadable,
	}
	if entry.Preview != inspection.PreviewNone {
		dto.Preview = &entry.Preview
	}
	if entry.Kind == inspection.KindTrack {
		dto.Track = &inspectionTrackDTO{Number: entry.Detail.Track, Seconds: entry.Detail.Seconds}
	}
	return dto
}

func toFoundDTO(found inspection.Found) inspectionFoundDTO {
	entry := toEntryDTO(found.Entry)
	return inspectionFoundDTO{
		ID:         entry.ID,
		ParentID:   entry.ParentID,
		Name:       entry.Name,
		Kind:       entry.Kind,
		Size:       entry.Size,
		Modified:   entry.Modified,
		Items:      entry.Items,
		Children:   entry.Children,
		Encrypted:  entry.Encrypted,
		Unreadable: entry.Unreadable,
		Preview:    entry.Preview,
		Track:      entry.Track,
		Location:   found.Location,
	}
}
