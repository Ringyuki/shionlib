package response

import (
	"encoding/json"

	"github.com/danielgtaylor/huma/v2"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/jsoncodec"
)

var JSONFormat = huma.Format{Marshal: jsoncodec.Encode, Unmarshal: json.Unmarshal}
