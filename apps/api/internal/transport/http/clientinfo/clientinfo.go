package clientinfo

import (
	"context"
	"net"
	"net/http"
	"net/netip"
	"strings"
)

type Info struct {
	IP        string
	UserAgent string
	Trusted   bool
}

type contextKey struct{}

func With(ctx context.Context, info Info) context.Context {
	return context.WithValue(ctx, contextKey{}, info)
}

func From(ctx context.Context) Info {
	info, _ := ctx.Value(contextKey{}).(Info)
	return info
}

type Resolver struct {
	trusted []netip.Prefix
}

func NewResolver(trusted []netip.Prefix) *Resolver {
	return &Resolver{trusted: trusted}
}

func (r *Resolver) Resolve(req *http.Request) Info {
	remote := remoteAddr(req)
	info := Info{IP: remote.String(), UserAgent: req.UserAgent()}
	if !remote.IsValid() {
		info.IP = ""
	}
	if !r.isTrusted(remote) {
		return info
	}
	info.Trusted = true
	for _, candidate := range []string{
		firstValue(req.Header.Get("X-Real-Ip")),
		firstValue(req.Header.Get("Cf-Connecting-Ip")),
		firstValue(req.Header.Get("X-Forwarded-For")),
	} {
		if addr, err := netip.ParseAddr(candidate); err == nil {
			info.IP = addr.Unmap().String()
			return info
		}
	}
	return info
}

func (r *Resolver) isTrusted(addr netip.Addr) bool {
	if !addr.IsValid() {
		return false
	}
	for _, prefix := range r.trusted {
		if prefix.Contains(addr) {
			return true
		}
	}
	return false
}

func remoteAddr(req *http.Request) netip.Addr {
	host, _, err := net.SplitHostPort(req.RemoteAddr)
	if err != nil {
		host = req.RemoteAddr
	}
	addr, err := netip.ParseAddr(host)
	if err != nil {
		return netip.Addr{}
	}
	return addr.Unmap()
}

func firstValue(raw string) string {
	first, _, _ := strings.Cut(raw, ",")
	return strings.TrimSpace(first)
}
