package catalog

import (
	"errors"

	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
)

var (
	ErrSourceUnavailable = apperror.Define(620101, "CATALOG_SOURCE_UNAVAILABLE", apperror.KindUpstreamFailed)
	ErrUnknownSource     = apperror.Define(620102, "CATALOG_UNKNOWN_SOURCE", apperror.KindInvalidArgument)
	ErrEntryNotFound     = apperror.Define(620103, "CATALOG_ENTRY_NOT_FOUND", apperror.KindNotFound)
)

var (
	ErrNotFound    = errors.New("catalog entry not found at source")
	ErrRateLimited = errors.New("catalog source rate limited")
	ErrExcluded    = errors.New("catalog entry excluded locally")
)
