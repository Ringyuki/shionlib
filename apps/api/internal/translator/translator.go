package translator

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/paging"
)

const (
	MaxNameLength     = 64
	MaxHomepageLength = 512
	MaxAliases        = 20
	MaxPerResource    = 6
	duplicateScanSize = 5000
	suggestionLimit   = 8
)

type Translator struct {
	ID        int
	Name      string
	Aliases   []string
	Homepage  *string
	CreatorID *int
	Created   time.Time
	Updated   time.Time
}

type Ref struct {
	ID   int
	Name string
}

type Summary struct {
	ID         int
	Name       string
	Aliases    []string
	WorksCount int
}

type Detail struct {
	Translator
	WorksCount int
}

type NewTranslator struct {
	Name      string
	CreatorID *int
}

type Page = paging.Page
