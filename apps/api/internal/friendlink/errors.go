package friendlink

import "github.com/Ringyuki/shionlib/apps/api/internal/apperror"

var ErrNotFound = apperror.Define(670101, "FRIEND_LINK_NOT_FOUND", apperror.KindNotFound)

var ErrStaleOrder = apperror.Define(670102, "FRIEND_LINK_ORDER_STALE", apperror.KindConflict)
