package sitemap

import (
	"context"
	"html"
	"slices"
	"strconv"
	"strings"
	"time"
)

type Service struct {
	store Store
	cache Cache
	now   func() time.Time
}

func NewService(store Store, cache Cache, now func() time.Time) *Service {
	return &Service{store: store, cache: cache, now: now}
}

func (s *Service) Index(ctx context.Context, siteURL string) (string, error) {
	return s.cached(ctx, "sitemap:index:"+siteURL, func() (string, error) {
		lastmod := s.now().UTC().Format(isoLayout)
		entries := []string{}
		for _, section := range Sections {
			count, err := s.store.Count(ctx, section)
			if err != nil {
				return "", err
			}
			for page := 1; page <= (count+PageSize-1)/PageSize; page++ {
				loc := siteURL + "/sitemap-" + string(section) + "-" + strconv.Itoa(page) + ".xml"
				entries = append(entries, "<sitemap><loc>"+escape(loc)+"</loc><lastmod>"+lastmod+"</lastmod></sitemap>")
			}
		}
		return xmlHeader + "\n" + stylesheet + "\n" + `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` + "\n" + strings.Join(entries, "\n") + "\n</sitemapindex>", nil
	})
}

func (s *Service) Section(ctx context.Context, siteURL, name string, page int) (string, error) {
	section := Section(name)
	if !slices.Contains(Sections, section) {
		return EmptyURLSet, nil
	}
	key := "sitemap:" + name + ":" + strconv.Itoa(page) + ":" + siteURL
	return s.cached(ctx, key, func() (string, error) {
		var entries []Entry
		if page >= 1 {
			found, err := s.store.Entries(ctx, section, (page-1)*PageSize, PageSize)
			if err != nil {
				return "", err
			}
			entries = found
		}
		priority := "0.8"
		if section == SectionGame {
			priority = "1.0"
		}
		urls := make([]string, len(entries))
		for i, entry := range entries {
			path := string(section) + "/" + strconv.Itoa(entry.ID)
			var b strings.Builder
			b.WriteString("<url><loc>" + localized(siteURL, DefaultLanguage, path) + "</loc>")
			for _, language := range Languages {
				b.WriteString(`<xhtml:link rel="alternate" hreflang="` + language + `" href="` + localized(siteURL, language, path) + `"/>`)
			}
			b.WriteString(`<xhtml:link rel="alternate" hreflang="x-default" href="` + localized(siteURL, DefaultLanguage, path) + `"/>`)
			b.WriteString("<lastmod>" + entry.Updated.UTC().Format(isoLayout) + "</lastmod><changefreq>weekly</changefreq><priority>" + priority + "</priority></url>")
			urls[i] = b.String()
		}
		return xmlHeader + "\n" + stylesheet + "\n" + `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">` + "\n" + strings.Join(urls, "\n") + "\n</urlset>", nil
	})
}

func (s *Service) cached(ctx context.Context, key string, build func() (string, error)) (string, error) {
	var cached string
	if found, err := s.cache.Get(ctx, key, &cached); err == nil && found {
		return cached, nil
	}
	xml, err := build()
	if err != nil {
		return "", err
	}
	_ = s.cache.Set(ctx, key, xml, CacheTTL)
	return xml, nil
}

func localized(siteURL, language, path string) string {
	return escape(strings.TrimSuffix(siteURL, "/") + "/" + language + "/" + path)
}

func escape(value string) string {
	return html.EscapeString(value)
}
