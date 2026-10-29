package uploadhttp

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
)

type adminUploadListInput struct {
	httpapi.PageQuery
	Stage  string `query:"stage" enum:"not_started,uploading,pending,processing,published,composed,rejected,canceled,expired"`
	Search string `query:"search" maxLength:"200" doc:"Part of the file name or of the uploader's name"`
	UserID int    `query:"userId" minimum:"0"`
	Failed bool   `query:"failed" doc:"Only uploads with a failure the browser reported"`
}

func (in *adminUploadListInput) filter() download.UploadFilter {
	filter := download.UploadFilter{Query: in.Search, FailedOnly: in.Failed}
	if in.Stage != "" {
		stage := download.UploadStage(in.Stage)
		filter.Stage = &stage
	}
	if in.UserID != 0 {
		filter.UserID = &in.UserID
	}
	return filter
}

type adminUploadPathInput struct {
	ID int `path:"id" minimum:"1"`
}
