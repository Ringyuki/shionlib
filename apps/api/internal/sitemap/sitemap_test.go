package sitemap_test

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/game/gametest"
	"github.com/Ringyuki/shionlib/apps/api/internal/sitemap"
)

type store struct {
	counts  map[sitemap.Section]int
	entries map[sitemap.Section][]sitemap.Entry
	offsets []int
}

func (s *store) Count(_ context.Context, section sitemap.Section) (int, error) {
	return s.counts[section], nil
}

func (s *store) Entries(_ context.Context, section sitemap.Section, offset, limit int) ([]sitemap.Entry, error) {
	s.offsets = append(s.offsets, offset)
	all := s.entries[section]
	start := min(offset, len(all))
	return all[start:min(start+limit, len(all))], nil
}

var generated = time.Date(2026, 10, 3, 1, 2, 3, 0, time.UTC)

func TestIndexListsOnePagePerFiftyThousandEntries(t *testing.T) {
	cache := gametest.NewCache()
	s := &store{counts: map[sitemap.Section]int{sitemap.SectionGame: 3, sitemap.SectionDeveloper: 50001}}
	service := sitemap.NewService(s, cache, func() time.Time { return generated })
	xml, err := service.Index(context.Background(), "https://shionlib.com")
	if err != nil {
		t.Fatal(err)
	}
	want := `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<sitemap><loc>https://shionlib.com/sitemap-game-1.xml</loc><lastmod>2026-10-03T01:02:03.000Z</lastmod></sitemap>
<sitemap><loc>https://shionlib.com/sitemap-developer-1.xml</loc><lastmod>2026-10-03T01:02:03.000Z</lastmod></sitemap>
<sitemap><loc>https://shionlib.com/sitemap-developer-2.xml</loc><lastmod>2026-10-03T01:02:03.000Z</lastmod></sitemap>
</sitemapindex>`
	if xml != want {
		t.Fatalf("unexpected index\n%s", xml)
	}
	if cache.TTLs["sitemap:index:https://shionlib.com"] != time.Hour {
		t.Fatalf("index is cached for an hour: %v", cache.TTLs)
	}
	s.counts[sitemap.SectionGame] = 0
	if again, _ := service.Index(context.Background(), "https://shionlib.com"); again != want {
		t.Fatal("cached index must be served")
	}
}

func TestSectionRendersLocalizedAlternates(t *testing.T) {
	cache := gametest.NewCache()
	s := &store{entries: map[sitemap.Section][]sitemap.Entry{sitemap.SectionGame: {{ID: 9, Updated: generated}}, sitemap.SectionCharacter: {{ID: 4, Updated: generated}}}}
	service := sitemap.NewService(s, cache, func() time.Time { return generated })
	xml, err := service.Section(context.Background(), "http://example.com", "game", 1)
	if err != nil {
		t.Fatal(err)
	}
	want := `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
<url><loc>http://example.com/zh/game/9</loc><xhtml:link rel="alternate" hreflang="zh" href="http://example.com/zh/game/9"/><xhtml:link rel="alternate" hreflang="ja" href="http://example.com/ja/game/9"/><xhtml:link rel="alternate" hreflang="en" href="http://example.com/en/game/9"/><xhtml:link rel="alternate" hreflang="x-default" href="http://example.com/zh/game/9"/><lastmod>2026-10-03T01:02:03.000Z</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>
</urlset>`
	if xml != want {
		t.Fatalf("unexpected section\n%s", xml)
	}
	character, _ := service.Section(context.Background(), "http://example.com", "character", 1)
	if !strings.Contains(character, "<priority>0.8</priority>") || !strings.Contains(character, "http://example.com/ja/character/4") {
		t.Fatalf("unexpected character section %s", character)
	}
	if !cache.Has("sitemap:game:1:http://example.com") {
		t.Fatal("sections are cached per page and site")
	}
	beyond, _ := service.Section(context.Background(), "http://example.com", "developer", 3)
	if !strings.HasSuffix(beyond, "xmlns:xhtml=\"http://www.w3.org/1999/xhtml\">\n\n</urlset>") || s.offsets[len(s.offsets)-1] != 100000 {
		t.Fatalf("pages beyond the data are empty url sets: %s %v", beyond, s.offsets)
	}
	invalid, _ := service.Section(context.Background(), "http://example.com", "user", 1)
	if invalid != sitemap.EmptyURLSet || cache.Has("sitemap:user:1:http://example.com") {
		t.Fatalf("unknown sections are empty and uncached: %s", invalid)
	}
}
