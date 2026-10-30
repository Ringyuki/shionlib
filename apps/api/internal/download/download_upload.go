package download

import (
	"slices"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

type UploadStage string

const (
	UploadNotStarted UploadStage = "not_started"
	UploadUploading  UploadStage = "uploading"
	UploadPending    UploadStage = "pending"
	UploadProcessing UploadStage = "processing"
	UploadPublished  UploadStage = "published"
	UploadComposed   UploadStage = "composed"
	UploadRejected   UploadStage = "rejected"
	UploadCanceled   UploadStage = "canceled"
	UploadExpired    UploadStage = "expired"
)

var uploadStages = []UploadStage{UploadNotStarted, UploadUploading, UploadPending, UploadProcessing, UploadPublished, UploadComposed, UploadRejected, UploadCanceled, UploadExpired}

func UploadStages() []UploadStage {
	return slices.Clone(uploadStages)
}

func (s UploadStage) Valid() bool {
	return slices.Contains(uploadStages, s)
}

type UploadKind string

const (
	UploadSession UploadKind = "session"
	UploadAttempt UploadKind = "attempt"
)

type UploadGame struct {
	ID      int
	TitleJP string
	TitleZH string
	TitleEN string
}

type UploadTarget struct {
	FileID              int
	ResourceID          int
	ResourceStatus      int
	ResourcePublishedAt *time.Time
	File                File
	Game                UploadGame
}

type UploadComposition struct {
	ID         int
	State      string
	ResourceID *int
	Game       UploadGame
}

type Upload struct {
	Kind         UploadKind
	ID           int
	FileName     string
	Size         int64
	UserID       int
	UserName     string
	Session      *upload.Session
	Target       *UploadTarget
	Composition  *UploadComposition
	FailureCount int
	Started      time.Time
	Stage        UploadStage
}

func (u Upload) FileStage() *Stage {
	if u.Target == nil {
		return nil
	}
	stage := u.Target.File.Stage()
	return &stage
}

type UploadFilter struct {
	Stage      *UploadStage
	Query      string
	UserID     *int
	FailedOnly bool
	Now        time.Time
}

type UploadDetail struct {
	Upload
	Held     bool
	Failures []upload.Failure
}

func StageOfUpload(session *upload.Session, target *UploadTarget, now time.Time) UploadStage {
	switch {
	case session == nil:
		return UploadNotStarted
	case session.AbortedAt != nil || session.Status == upload.StatusAborted:
		return UploadCanceled
	case target != nil:
		switch target.File.Stage() {
		case StageStored:
			return UploadPublished
		case StageRejected:
			return UploadRejected
		default:
			return UploadProcessing
		}
	case session.CompositionID != nil:
		return UploadComposed
	case session.SubmittedAt != nil:
		return UploadPublished
	case session.Status == upload.StatusCompleted:
		return UploadPending
	case session.Status == upload.StatusUploading && !session.Expired(now):
		return UploadUploading
	default:
		return UploadExpired
	}
}
