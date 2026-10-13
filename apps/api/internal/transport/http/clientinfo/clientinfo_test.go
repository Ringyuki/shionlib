package clientinfo_test

import (
	"net/http/httptest"
	"net/netip"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/clientinfo"
)

func TestForwardedAddressesAreOnlyTrustedFromKnownProxies(t *testing.T) {
	resolver := clientinfo.NewResolver([]netip.Prefix{netip.MustParsePrefix("10.0.0.0/8")})

	direct := httptest.NewRequest("GET", "/", nil)
	direct.RemoteAddr = "203.0.113.9:4000"
	direct.Header.Set("X-Forwarded-For", "1.2.3.4")
	if info := resolver.Resolve(direct); info.IP != "203.0.113.9" || info.Trusted {
		t.Fatalf("spoofed header from an untrusted peer: %+v", info)
	}

	proxied := httptest.NewRequest("GET", "/", nil)
	proxied.RemoteAddr = "10.1.2.3:4000"
	proxied.Header.Set("X-Forwarded-For", "198.51.100.7, 10.1.2.3")
	proxied.Header.Set("User-Agent", "test-agent")
	if info := resolver.Resolve(proxied); info.IP != "198.51.100.7" || !info.Trusted || info.UserAgent != "test-agent" {
		t.Fatalf("forwarded address from a trusted proxy: %+v", info)
	}

	realIP := httptest.NewRequest("GET", "/", nil)
	realIP.RemoteAddr = "10.1.2.3:4000"
	realIP.Header.Set("X-Real-Ip", "::ffff:198.51.100.8")
	realIP.Header.Set("X-Forwarded-For", "198.51.100.7")
	if info := resolver.Resolve(realIP); info.IP != "198.51.100.8" {
		t.Fatalf("X-Real-Ip wins and is unmapped: %+v", info)
	}

	garbage := httptest.NewRequest("GET", "/", nil)
	garbage.RemoteAddr = "10.1.2.3:4000"
	garbage.Header.Set("X-Forwarded-For", "not-an-ip")
	if info := resolver.Resolve(garbage); info.IP != "10.1.2.3" {
		t.Fatalf("unparseable headers fall back to the peer: %+v", info)
	}
}
