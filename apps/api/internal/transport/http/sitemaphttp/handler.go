package sitemaphttp

import (
	"context"
	_ "embed"
	"net/http"
	"regexp"
	"strings"

	"github.com/danielgtaylor/huma/v2"

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

var (
	tags      = []string{"site"}
	validHost = regexp.MustCompile(`^[A-Za-z0-9.-]+(:[0-9]{1,5})?$`)
)

type requestSite struct {
	host           string
	scheme         string
	forwardedHost  string
	forwardedProto string
}

func (r *requestSite) Resolve(ctx huma.Context) []error {
	r.host = ctx.Host()
	r.scheme = "http"
	if ctx.TLS() != nil {
		r.scheme = "https"
	}
	r.forwardedHost = firstValue(ctx.Header("X-Forwarded-Host"))
	r.forwardedProto = firstValue(ctx.Header("X-Forwarded-Proto"))
	return nil
}

type sitemapIndexInput struct {
	requestSite
}

type sitemapSectionInput struct {
	Type string `path:"type" doc:"game, developer or character"`
	Page int    `path:"page"`
	requestSite
}

type sitemapOutput struct {
	ContentType  string `header:"Content-Type"`
	CacheControl string `header:"Cache-Control"`
	Body         []byte
}

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

func (h *Handler) index(ctx context.Context, in *sitemapIndexInput) (*sitemapOutput, error) {
	xml, err := h.service.Index(ctx, h.siteURL(ctx, in.requestSite))
	if err != nil {
		return nil, err
	}
	return &sitemapOutput{ContentType: xmlContentType, CacheControl: xmlCacheMaxAge, Body: []byte(xml)}, nil
}

func (h *Handler) stylesheet(context.Context, *struct{}) (*sitemapOutput, error) {
	return &sitemapOutput{ContentType: xslContentType, CacheControl: xslCacheMaxAge, Body: stylesheet}, nil
}

func (h *Handler) section(ctx context.Context, in *sitemapSectionInput) (*sitemapOutput, error) {
	xml, err := h.service.Section(ctx, h.siteURL(ctx, in.requestSite), in.Type, in.Page)
	if err != nil {
		return nil, err
	}
	return &sitemapOutput{ContentType: xmlContentType, CacheControl: xmlCacheMaxAge, Body: []byte(xml)}, nil
}

func (h *Handler) siteURL(ctx context.Context, site requestSite) string {
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

func firstValue(raw string) string {
	first, _, _ := strings.Cut(raw, ",")
	return strings.TrimSpace(first)
}
