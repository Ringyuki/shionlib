package mediahttp

import (
	"github.com/danielgtaylor/huma/v2"
)

type adImageInput struct {
	RawBody huma.MultipartFormFiles[struct {
		File huma.FormFile `form:"file" required:"false"`
	}]
}

type friendLinkLogoInput struct {
	RawBody huma.MultipartFormFiles[struct {
		File huma.FormFile `form:"file" required:"false"`
	}]
}
