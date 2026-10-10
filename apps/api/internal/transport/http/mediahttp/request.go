package mediahttp

import (
	"github.com/danielgtaylor/huma/v2"
)

type richTextImageInput struct {
	RawBody huma.MultipartFormFiles[struct {
		File huma.FormFile `form:"file" required:"false"`
	}]
}

type adImageInput struct {
	RawBody huma.MultipartFormFiles[struct {
		File huma.FormFile `form:"file" required:"false"`
	}]
}
