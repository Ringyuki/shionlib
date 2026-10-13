package translator

import "github.com/Ringyuki/shionlib/apps/api/internal/apperror"

var ErrNotFound = apperror.Define(600101, "TRANSLATOR_NOT_FOUND", apperror.KindNotFound)

var ErrNameTaken = apperror.Define(600102, "TRANSLATOR_NAME_TAKEN", apperror.KindConflict)

var ErrTooMany = apperror.Define(600103, "TRANSLATOR_TOO_MANY", apperror.KindInvalidArgument)

var ErrMergeNeedsOthers = apperror.Define(600104, "TRANSLATOR_MERGE_NEEDS_OTHERS", apperror.KindInvalidArgument)
