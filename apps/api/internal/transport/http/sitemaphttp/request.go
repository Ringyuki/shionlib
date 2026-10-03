package sitemaphttp

import (
	_ "embed"
	"strings"

	"github.com/danielgtaylor/huma/v2"
)

func (r *requestSiteInput) Resolve(ctx huma.Context) []error {
	r.host = ctx.Host()
	r.scheme = "http"
	if ctx.TLS() != nil {
		r.scheme = "https"
	}
	r.forwardedHost = firstValue(ctx.Header("X-Forwarded-Host"))
	r.forwardedProto = firstValue(ctx.Header("X-Forwarded-Proto"))
	return nil
}

func firstValue(raw string) string {
	first, _, _ := strings.Cut(raw, ",")
	return strings.TrimSpace(first)
}

type requestSiteInput struct {
	host           string
	scheme         string
	forwardedHost  string
	forwardedProto string
}

type sitemapIndexInput struct {
	requestSiteInput
}

type sitemapSectionInput struct {
	Type string `path:"type" doc:"game, developer or character"`
	Page int    `path:"page"`
	requestSiteInput
}
