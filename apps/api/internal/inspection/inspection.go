package inspection

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/paging"
)

type Status string

const (
	StatusReady  Status = "ready"
	StatusPlain  Status = "plain"
	StatusFailed Status = "failed"
)

type Kind string

const (
	KindFolder  Kind = "folder"
	KindFile    Kind = "file"
	KindArchive Kind = "archive"
	KindDisc    Kind = "disc"
	KindTrack   Kind = "track"
)

func (k Kind) Container() bool {
	return k == KindArchive || k == KindDisc
}

type Preview string

const (
	PreviewNone  Preview = ""
	PreviewText  Preview = "text"
	PreviewImage Preview = "image"
)

const (
	EntryLimit  = 200_000
	MaxPageSize = 200
	entryBatch  = 1000
	orphanAge   = time.Hour
	sweepBatch  = 20
)

type Page = paging.Page

type Archive struct {
	Format          string
	Solid           bool
	Volumes         int
	Recovery        bool
	RecoveryPercent int
	NameEncoding    string
	Unsupported     bool
}

type Detection struct {
	Path      string
	Signature string
}

type Scan struct {
	Engine       string
	SignaturesAt *time.Time
	Scanned      int
	Skipped      []string
	Limit        int64
	Detections   []Detection
	At           *time.Time
	ClearedAt    *time.Time
}

type Totals struct {
	Files     int
	Folders   int
	Size      int64
	Discs     int
	DiscFiles int
}

type Inspection struct {
	ID         int
	ResourceID int
	Status     Status
	Archive    Archive
	Totals     Totals
	Truncated  bool
	Verified   bool
	Scan       Scan
	Created    time.Time
}

type Detail struct {
	Format  string
	Label   string
	Files   int
	Folders int
	Track   int
	Seconds int
	Signals []string
}

func (d Detail) Empty() bool {
	return d.Format == "" && d.Label == "" && d.Files == 0 && d.Folders == 0 && d.Track == 0 && d.Seconds == 0 && len(d.Signals) == 0
}

type Entry struct {
	ID           int
	InspectionID int
	ParentID     *int
	Name         string
	Kind         Kind
	Size         int64
	Modified     *time.Time
	Items        int
	Children     int
	Encrypted    bool
	Unreadable   bool
	Preview      Preview
	Detail       Detail
}

type FilePath struct {
	Path string
	Size int64
}

type Found struct {
	Entry
	Location string
}

type View struct {
	Inspection
	Discs []Entry
}

type NewInspection struct {
	ResourceID int
	Status     Status
	Archive    Archive
	Totals     Totals
	Truncated  bool
	Verified   bool
	Scan       Scan
}

type NewEntry struct {
	ParentID   *int
	Position   int
	Name       string
	Kind       Kind
	Size       int64
	Modified   *time.Time
	Items      int
	Children   int
	Encrypted  bool
	Unreadable bool
	Detail     Detail
}

type Recorded struct {
	ID      int
	Entries []int
}
