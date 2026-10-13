package composition

import (
	"errors"

	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
)

var ErrNotFound = apperror.Define(660101, "COMPOSITION_NOT_FOUND", apperror.KindNotFound)

var ErrNotOwner = apperror.Define(660102, "COMPOSITION_NOT_OWNER", apperror.KindPermissionDenied)

var ErrBaseUnusable = apperror.Define(660103, "COMPOSITION_BASE_UNUSABLE", apperror.KindConflict)

var ErrNotDraft = apperror.Define(660104, "COMPOSITION_NOT_DRAFT", apperror.KindConflict)

var ErrNotReady = apperror.Define(660105, "COMPOSITION_NOT_READY", apperror.KindConflict)

var ErrNothingToApply = apperror.Define(660106, "COMPOSITION_NOTHING_TO_APPLY", apperror.KindConflict)

var ErrPathConflict = apperror.Define(660107, "COMPOSITION_PATH_CONFLICT", apperror.KindConflict)

var ErrQueueFull = apperror.Define(660108, "COMPOSITION_QUEUE_FULL", apperror.KindConflict)

var ErrNotFailed = apperror.Define(660109, "COMPOSITION_NOT_FAILED", apperror.KindConflict)

var ErrNotComposed = apperror.Define(660110, "COMPOSITION_NOT_COMPOSED", apperror.KindConflict)

var ErrBusy = apperror.Define(660111, "COMPOSITION_BUSY", apperror.KindConflict)

var ErrBaseGone = apperror.Define(660112, "COMPOSITION_BASE_GONE", apperror.KindConflict)

var ErrChecksOff = apperror.Define(660113, "COMPOSITION_CHECKS_OFF", apperror.KindConflict)

var ErrNoSlot = errors.New("every composition slot is taken")

var ErrUnreadable = errors.New("the archive cannot be unpacked")

var ErrPlaceMissing = errors.New("the folder is not in the unpacked archive")
