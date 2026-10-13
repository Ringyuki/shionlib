package settinghttp

import (
	"encoding/json"

	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
)

type settingUpdateInput struct {
	Name string `path:"name" minLength:"3" maxLength:"128" pattern:"^[a-z][a-z0-9_]*\\.[a-z][a-z0-9_]*$"`
	Body struct {
		Value json.RawMessage `json:"value" doc:"The new value as JSON: a number for int, bytes, float and duration (seconds), a boolean for flag, a string for text"`
	}
}

type settingResetInput struct {
	Name string `path:"name" minLength:"3" maxLength:"128" pattern:"^[a-z][a-z0-9_]*\\.[a-z][a-z0-9_]*$"`
}

type settingHistoryInput struct {
	httpapi.PageQuery
	Name string `path:"name" minLength:"3" maxLength:"128" pattern:"^[a-z][a-z0-9_]*\\.[a-z][a-z0-9_]*$"`
}
