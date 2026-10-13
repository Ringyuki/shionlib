package sitemap

import (
	"time"
)

type Section string

const (
	SectionGame      Section = "game"
	SectionDeveloper Section = "developer"
	SectionCharacter Section = "character"
)

var Sections = []Section{SectionGame, SectionDeveloper, SectionCharacter}

const (
	PageSize        = 50000
	CacheTTL        = time.Hour
	DefaultLanguage = "zh"
	isoLayout       = "2006-01-02T15:04:05.000Z"
	stylesheet      = `<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>`
	xmlHeader       = `<?xml version="1.0" encoding="UTF-8"?>`
	EmptyURLSet     = xmlHeader + "\n" + `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`
)

var Languages = []string{"zh", "ja", "en"}

type Entry struct {
	ID      int
	Updated time.Time
}
