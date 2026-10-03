package ai

import "github.com/Ringyuki/shionlib/apps/api/internal/apperror"

var (
	ErrProviderNotFound        = apperror.Define(630101, "AI_PROVIDER_NOT_FOUND", apperror.KindNotFound)
	ErrProviderNameTaken       = apperror.Define(630102, "AI_PROVIDER_NAME_TAKEN", apperror.KindConflict)
	ErrBaseURLRequired         = apperror.Define(630103, "AI_PROVIDER_BASE_URL_REQUIRED", apperror.KindUnprocessable)
	ErrModelNotFound           = apperror.Define(630104, "AI_MODEL_NOT_FOUND", apperror.KindNotFound)
	ErrModelTaken              = apperror.Define(630105, "AI_MODEL_TAKEN", apperror.KindConflict)
	ErrDefaultModelDelete      = apperror.Define(630106, "AI_DEFAULT_MODEL_DELETE", apperror.KindConflict)
	ErrRouteNotFound           = apperror.Define(630107, "AI_ROUTE_NOT_FOUND", apperror.KindNotFound)
	ErrRouteTaken              = apperror.Define(630108, "AI_ROUTE_TAKEN", apperror.KindConflict)
	ErrProtocolUnsupported     = apperror.Define(630109, "AI_PROTOCOL_UNSUPPORTED", apperror.KindUnprocessable)
	ErrRouteOrderInvalid       = apperror.Define(630110, "AI_ROUTE_ORDER_INVALID", apperror.KindUnprocessable)
	ErrSceneNotFound           = apperror.Define(630111, "AI_SCENE_NOT_FOUND", apperror.KindNotFound)
	ErrSceneModelMismatch      = apperror.Define(630112, "AI_SCENE_MODEL_MISMATCH", apperror.KindUnprocessable)
	ErrCatalogModelNotFound    = apperror.Define(630113, "AI_CATALOG_MODEL_NOT_FOUND", apperror.KindNotFound)
	ErrAdjustmentNotFound      = apperror.Define(630114, "AI_ADJUSTMENT_NOT_FOUND", apperror.KindNotFound)
	ErrSceneNotConfigured      = apperror.Define(630115, "AI_SCENE_NOT_CONFIGURED", apperror.KindUnavailable)
	ErrUnavailable             = apperror.Define(630116, "AI_UNAVAILABLE", apperror.KindUpstreamFailed)
	ErrOutputMalformed         = apperror.Define(630117, "AI_OUTPUT_MALFORMED", apperror.KindUpstreamFailed)
	ErrCatalogUnavailable      = apperror.Define(630118, "AI_CATALOG_UNAVAILABLE", apperror.KindUpstreamFailed)
	ErrRequestNotFound         = apperror.Define(630119, "AI_REQUEST_NOT_FOUND", apperror.KindNotFound)
	ErrCatalogOwned            = apperror.Define(630120, "AI_CATALOG_OWNED", apperror.KindUnprocessable)
	ErrSchemaInvalid           = apperror.Define(630121, "AI_SCHEMA_INVALID", apperror.KindUnprocessable)
	ErrPlaygroundTarget        = apperror.Define(630122, "AI_PLAYGROUND_TARGET_NOT_FOUND", apperror.KindNotFound)
	ErrCatalogProviderNotFound = apperror.Define(630123, "AI_CATALOG_PROVIDER_NOT_FOUND", apperror.KindNotFound)
)
