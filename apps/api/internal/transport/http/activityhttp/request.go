package activityhttp

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
)

type listActivitiesInput struct {
	httpapi.PageQuery
	Category string `query:"category" enum:"comments,gameCreates,walkthroughCreates,edits,files"`
}
