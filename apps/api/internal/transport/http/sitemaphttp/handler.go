package sitemaphttp

import (
	"context"
	_ "embed"
	"net/http"
	"regexp"
	"strings"

	"github.com/Ringyuki/shionlib/apps/api/internal/sitemap"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/clientinfo"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
)

//go:embed sitemap.xsl
var stylesheet []byte

const (
	xmlContentType = "application/xml; charset=utf-8"
	xslContentType = "text/xsl; charset=utf-8"
	xmlCacheMaxAge = "public, max-age=3600"
	xslCacheMaxAge = "public, max-age=86400"
)

var tags = []string{"site"}

var validHost = regexp.MustCompile(`^[A-Za-z0-9.-]+(:[0-9]{1,5})?$`)

type Handler struct {
	service  *sitemap.Service
	fallback string
}

func NewHandler(service *sitemap.Service, fallbackSiteURL string) *Handler {
	return &Handler{service: service, fallback: strings.TrimSuffix(fallbackSiteURL, "/")}
}

func (h *Handler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "sitemap.index", Method: http.MethodGet, Path: "/sitemap.xml", Summary: "Sitemap index", Tags: tags, Hidden: true}, h.index)
	httpapi.Register(api, httpapi.Route{ID: "sitemap.stylesheet", Method: http.MethodGet, Path: "/sitemap.xsl", Summary: "Sitemap stylesheet", Tags: tags, Hidden: true}, h.stylesheet)
	httpapi.Register(api, httpapi.Route{ID: "sitemap.section", Method: http.MethodGet, Path: "/sitemap-{type}-{page}.xml", Summary: "Sitemap section page", Tags: tags, Hidden: true}, h.section)
}

func (h *Handler) index(ctx context.Context, in *sitemapIndexInput) (*sitemapOutputDTO, error) {
	xml, err := h.service.Index(ctx, h.siteURL(ctx, in.requestSiteInput))
	if err != nil {
		return nil, err
	}
	return &sitemapOutputDTO{ContentType: xmlContentType, CacheControl: xmlCacheMaxAge, Body: []byte(xml)}, nil
}

func (h *Handler) stylesheet(context.Context, *struct{}) (*sitemapOutputDTO, error) {
	return &sitemapOutputDTO{ContentType: xslContentType, CacheControl: xslCacheMaxAge, Body: stylesheet}, nil
}

func (h *Handler) section(ctx context.Context, in *sitemapSectionInput) (*sitemapOutputDTO, error) {
	xml, err := h.service.Section(ctx, h.siteURL(ctx, in.requestSiteInput), in.Type, in.Page)
	if err != nil {
		return nil, err
	}
	return &sitemapOutputDTO{ContentType: xmlContentType, CacheControl: xmlCacheMaxAge, Body: []byte(xml)}, nil
}

func (h *Handler) siteURL(ctx context.Context, site requestSiteInput) string {
	host, scheme := site.host, site.scheme
	if clientinfo.From(ctx).Trusted {
		if site.forwardedHost != "" {
			host = site.forwardedHost
		}
		if site.forwardedProto != "" {
			scheme = site.forwardedProto
		}
	}
	if !validHost.MatchString(host) || (scheme != "http" && scheme != "https") {
		return h.fallback
	}
	return scheme + "://" + host
}
