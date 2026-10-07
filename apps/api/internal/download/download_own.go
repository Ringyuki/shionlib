package download

import (
	"slices"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

type Stage string

const (
	StageChecking    Stage = "checking"
	StageStoring     Stage = "storing"
	StageStored      Stage = "stored"
	StageUnderReview Stage = "under_review"
	StageRejected    Stage = "rejected"
)

type Rejection string

const (
	RejectionTruncated     Rejection = "truncated"
	RejectionUnsupported   Rejection = "unsupported"
	RejectionEncrypted     Rejection = "encrypted"
	RejectionHarmful       Rejection = "harmful"
	RejectionIncompleteSet Rejection = "incomplete_set"
)

var rejections = map[CheckStatus]Rejection{
	CheckBrokenOrTruncated:   RejectionTruncated,
	CheckBrokenOrUnsupported: RejectionUnsupported,
	CheckEncrypted:           RejectionEncrypted,
	CheckHarmful:             RejectionHarmful,
	CheckIncompleteSet:       RejectionIncompleteSet,
}

func (c CheckStatus) Rejection() (Rejection, bool) {
	rejection, ok := rejections[c]
	return rejection, ok
}

func (f File) Stage() Stage {
	switch {
	case f.Type != FileTypeObjectStore:
		return StageStored
	case f.CheckStatus == CheckHarmfulPendingReview:
		return StageUnderReview
	case f.Status == FileInObjectStore:
		return StageStored
	case f.CheckStatus.Rejected():
		return StageRejected
	case f.CheckStatus == CheckOK:
		return StageStoring
	default:
		return StageChecking
	}
}

type OwnScope string

const (
	OwnAll        OwnScope = "all"
	OwnProcessing OwnScope = "processing"
	OwnPublished  OwnScope = "published"
)

type OwnSort string

const (
	OwnSortUpdated   OwnSort = "updated"
	OwnSortDownloads OwnSort = "downloads"
)

type OwnQuery struct {
	Scope     OwnScope
	Search    string
	Sort      OwnSort
	Ascending bool
}

const OwnRecentWindow = 30 * 24 * time.Hour

type OwnSummary struct {
	Processing int
	Published  int
	Downloads  int
	Games      int
	Files      int
	Recent     int
}

func (r GameResource) Processing() bool {
	return !r.Published() || slices.ContainsFunc(r.Files, func(file GameFile) bool { return file.Stage() != StageStored })
}

func (r GameResource) In(scope OwnScope) bool {
	return scope == OwnAll || r.Processing() == (scope == OwnProcessing)
}

type OwnResource struct {
	GameResource
	Game game.Card
}
