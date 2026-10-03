package sitemaphttp

import (
	_ "embed"
)

type sitemapOutputDTO struct {
	ContentType  string `header:"Content-Type"`
	CacheControl string `header:"Cache-Control"`
	Body         []byte
}
