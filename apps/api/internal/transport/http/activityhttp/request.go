package activityhttp

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
)

type listActivitiesInput struct {
	httpapi.PageQuery
	Category string `query:"category" enum:"files,comments,walkthroughCreates" doc:"Only one kind of happening; every kind when left out"`
}
