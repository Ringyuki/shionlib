package download

import (
	"slices"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/paging"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

const (
	ResourceActive  = 1
	ResourceRemoved = 2
)

const (
	FileTypeObjectStore = 1
	FileTypeDirectLink  = 2
	FileTypeThirdParty  = 3
)

const (
	FilePending        = 1
	FileOnServer       = 2
	FileInObjectStore  = 3
	migrationCreatorID = 1
)

type CheckStatus int

const (
	CheckPending              CheckStatus = 0
	CheckOK                   CheckStatus = 1
	CheckBrokenOrTruncated    CheckStatus = 2
	CheckBrokenOrUnsupported  CheckStatus = 3
	CheckEncrypted            CheckStatus = 4
	CheckHarmful              CheckStatus = 5
	CheckHarmfulPendingReview CheckStatus = 6
)

func (c CheckStatus) Rejected() bool {
	return c >= CheckBrokenOrTruncated && c <= CheckHarmful
}

var Platforms = []string{"win", "mac", "ios", "and", "lin", "ps3", "ps4", "psv", "psp", "swi", "dvd"}

var Languages = []string{"en", "zh", "zh-hant", "jp"}

var Simulators = []string{"KRKR", "ONS", "ARTEMIS", "OTHER"}

func NeedsSimulator(platforms []string) bool {
	return slices.Contains(platforms, "and") || slices.Contains(platforms, "ios")
}

type Resource struct {
	ID              int
	GameID          int
	Status          int
	Platforms       []string
	Languages       []string
	Simulator       *string
	Note            *string
	Downloads       int
	UploadSessionID *int
	CreatorID       int
	Created         time.Time
	Updated         time.Time
}

type File struct {
	ID              int
	ResourceID      int
	GameID          int
	ResourceStatus  int
	Type            int
	Name            string
	Path            *string
	Size            int64
	URL             *string
	StorageKey      *string
	ContentType     *string
	HashAlgorithm   upload.HashAlgorithm
	Hash            string
	UploadSessionID *int
	Status          int
	CheckStatus     CheckStatus
	FalsePositive   bool
	CreatorID       int
	Created         time.Time
	Updated         time.Time
}

type History struct {
	ID              int
	FileID          int
	Size            int64
	HashAlgorithm   upload.HashAlgorithm
	Hash            string
	StorageKey      *string
	Reason          *string
	UploadSessionID *int
	OperatorID      int
	Created         time.Time
}

type HistoryEntry struct {
	History
	Operator user.Summary
}

type MalwareCaseRef struct {
	ID      int
	Viruses []string
}

type HistoryRef struct {
	ID         int
	Reason     *string
	Created    time.Time
	OperatorID int
}

type GameFile struct {
	File
	MalwareCases  []MalwareCaseRef
	Creator       user.Summary
	RecentHistory []HistoryRef
}

func (f GameFile) LatestReupload() *HistoryRef {
	if len(f.RecentHistory) < 2 {
		return nil
	}
	latest := f.RecentHistory[0]
	return &latest
}

type GameResource struct {
	Resource
	Creator user.Summary
	Files   []GameFile
}

type Release struct {
	Resource
	Game       game.Card
	FileNames  []string
	FilesCount int
	Creator    user.Summary
}

type UserResource struct {
	Resource
	Game       game.Card
	FileNames  []string
	FilesCount int
	Creator    user.Summary
}

type UserResources struct {
	Items             []UserResource
	Total             int
	IsCurrentUser     bool
	HasOngoingSession bool
}

type NewResource struct {
	GameID          int
	Platforms       []string
	Languages       []string
	Simulator       *string
	Note            *string
	UploadSessionID *int
	CreatorID       int
}

type NewFile struct {
	ResourceID      int
	Type            int
	Name            string
	Path            *string
	Size            int64
	StorageKey      *string
	ContentType     *string
	HashAlgorithm   upload.HashAlgorithm
	Hash            string
	UploadSessionID *int
	Status          int
	CreatorID       int
}

type FileContent struct {
	Path            string
	Size            int64
	Hash            string
	HashAlgorithm   upload.HashAlgorithm
	ContentType     *string
	UploadSessionID int
}

type NewHistory struct {
	FileID          int
	Size            int64
	HashAlgorithm   upload.HashAlgorithm
	Hash            string
	StorageKey      *string
	Reason          *string
	UploadSessionID *int
	OperatorID      int
}

type ResourceChanges struct {
	Platforms []string
	Languages []string
	Simulator *string
	Note      *string
	FileName  *string
}

type CreateInput struct {
	FileName        string
	Platforms       []string
	Languages       []string
	Simulator       *string
	Note            *string
	UploadSessionID int
}

type MigrateResourceInput struct {
	Platforms []string
	Languages []string
	Simulator *string
	Note      *string
}

type MigrateFileInput struct {
	FileName    string
	FileSize    int64
	FileHash    string
	ContentType string
	StorageKey  string
}

type ReuploadInput struct {
	UploadSessionID int
	Reason          *string
}

type Page = paging.Page

const (
	TransferQueue       = "file_transfer"
	TransferConcurrency = 2
	transferAttempts    = 5
	purgeAttempts       = 10
)

const requeueBatch = 200
