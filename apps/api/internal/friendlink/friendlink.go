package friendlink

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/patch"
)

const (
	MaxNameLength        = 50
	MaxURLLength         = 500
	MaxLogoLength        = 500
	MaxDescriptionLength = 200
)

type Link struct {
	ID          int
	Name        string
	URL         string
	Logo        *string
	Description string
	Visible     bool
	Position    int
	Created     time.Time
	Updated     time.Time
}

type NewLink struct {
	Name        string
	URL         string
	Logo        *string
	Description string
	Visible     bool
}

type Changes struct {
	Name        *string
	URL         *string
	Logo        patch.Clearable[string]
	Description *string
	Visible     *bool
}
