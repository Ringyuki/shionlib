package ad

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
)

var ErrNotFound = apperror.Define(580101, "AD_NOT_FOUND", apperror.KindNotFound)

var ErrNoMaterial = apperror.Define(580102, "AD_NO_MATERIAL", apperror.KindInvalidArgument)

var ErrSideIncomplete = apperror.Define(580103, "AD_SIDE_INCOMPLETE", apperror.KindInvalidArgument)

var ErrSlotNeedsMaterial = apperror.Define(580104, "AD_SLOT_NEEDS_MATERIAL", apperror.KindInvalidArgument)

var ErrInvalidDraft = apperror.Define(580105, "AD_INVALID", apperror.KindInvalidArgument)

var ErrScheduleReversed = apperror.Define(580106, "AD_SCHEDULE_REVERSED", apperror.KindInvalidArgument)
