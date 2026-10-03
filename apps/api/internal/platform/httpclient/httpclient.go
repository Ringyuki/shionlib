package httpclient

import (
	"net"
	"net/http"
	"time"
)

type Options struct {
	Timeout         time.Duration
	MaxIdlePerHost  int
	IdleConnTimeout time.Duration
}

func New(opts Options) *http.Client {
	if opts.Timeout <= 0 {
		opts.Timeout = 15 * time.Second
	}
	if opts.MaxIdlePerHost <= 0 {
		opts.MaxIdlePerHost = 16
	}
	if opts.IdleConnTimeout <= 0 {
		opts.IdleConnTimeout = 90 * time.Second
	}
	transport := &http.Transport{
		Proxy:                 http.ProxyFromEnvironment,
		DialContext:           (&net.Dialer{Timeout: 10 * time.Second, KeepAlive: 30 * time.Second}).DialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          128,
		MaxIdleConnsPerHost:   opts.MaxIdlePerHost,
		IdleConnTimeout:       opts.IdleConnTimeout,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: time.Second,
		ResponseHeaderTimeout: opts.Timeout,
	}
	return &http.Client{Timeout: opts.Timeout, Transport: transport}
}
