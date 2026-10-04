package config

import (
	"errors"
	"fmt"
	"net/netip"
	"net/url"
	"slices"
	"strings"
	"time"
	_ "time/tzdata"

	"github.com/caarlos0/env/v11"
)

func Load() (*Config, error) {
	return LoadFrom(nil)
}

func LoadFrom(environment map[string]string) (*Config, error) {
	cfg := &Config{}
	options := env.Options{}
	if environment != nil {
		options.Environment = environment
	}
	if err := env.ParseWithOptions(cfg, options); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}
	cfg.normalize()
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	return cfg, nil
}

func (c *Config) normalize() {
	c.HTTP.CORSOrigins = trimAll(c.HTTP.CORSOrigins)
	c.HTTP.CORSMethods = trimAll(c.HTTP.CORSMethods)
	c.HTTP.TrustedProxies = trimAll(c.HTTP.TrustedProxies)
	c.WebAuthn.Origins = trimAll(c.WebAuthn.Origins)
	c.OIDC.AllowedOrigins = trimAll(c.OIDC.AllowedOrigins)
	c.OIDC.Scopes = trimAll(c.OIDC.Scopes)
	c.Catalog.Hikarinagi.Scopes = trimAll(c.Catalog.Hikarinagi.Scopes)
	c.Download.Mode = strings.ToLower(strings.TrimSpace(c.Download.Mode))
	c.Redis.KeyPrefix = strings.TrimSuffix(c.Redis.KeyPrefix, ":")
}

func (c *Config) Validate() error {
	var errs []error
	require := func(ok bool, format string, args ...any) {
		if !ok {
			errs = append(errs, fmt.Errorf(format, args...))
		}
	}
	require(c.Database.URL != "", "DATABASE_URL is required")
	require(c.Database.MaxConns > 0, "DATABASE_MAX_CONNS must be positive")
	require(c.Token.Secret != "", "TOKEN_SECRET is required")
	require(len(c.Token.Secret) >= 16, "TOKEN_SECRET must be at least 16 characters")
	require(c.Token.RefreshPepper != "", "REFRESH_TOKEN_PEPPER is required")
	require(c.Token.ExpiresIn > 0, "TOKEN_EXPIRES_IN must be positive")
	require(c.Token.RefreshShortWindow > 0, "REFRESH_TOKEN_SHORT_WINDOW must be positive")
	require(c.Token.RefreshLongWindow >= c.Token.RefreshShortWindow, "REFRESH_TOKEN_LONG_WINDOW must not be shorter than REFRESH_TOKEN_SHORT_WINDOW")
	require(c.Token.RefreshAlgorithmVersion != "" && !strings.Contains(c.Token.RefreshAlgorithmVersion, "."), "REFRESH_TOKEN_ALGORITHM_VERSION must be non-empty and must not contain '.'")
	require(c.Token.RefreshRotationGrace >= 0, "REFRESH_TOKEN_ROTATION_GRACE must not be negative")
	require(c.WebAuthn.RPID != "" && c.WebAuthn.RPName != "", "WEBAUTHN_RP_ID and WEBAUTHN_RP_NAME are required")
	require(len(c.WebAuthn.Origins) > 0, "WEBAUTHN_ORIGINS must list at least one origin")
	require(c.WebAuthn.Timeout > 0 && c.WebAuthn.ChallengeTTL > 0, "WEBAUTHN_TIMEOUT and WEBAUTHN_CHALLENGE_TTL must be positive")
	require(len(c.OIDC.AllowedOrigins) > 0, "OIDC_ALLOWED_ORIGINS must list at least one origin")
	require(c.OIDC.ClientID != "", "OIDC_CLIENT_ID is required")
	require(c.HTTP.Port > 0 && c.HTTP.Port < 65536, "PORT must be a valid TCP port")
	require(slices.Contains([]string{"direct", "worker"}, c.Download.Mode), "FILE_DOWNLOAD_MODE must be direct or worker")
	require(c.Download.Mode != "worker" || c.Download.TicketSecret != "", "FILE_DOWNLOAD_TICKET_SECRET is required when FILE_DOWNLOAD_MODE=worker")
	require(slices.Contains([]string{"elastic", "postal"}, c.Email.Provider), "EMAIL_PROVIDER must be elastic or postal")
	require(slices.Contains([]string{"pg", "meilisearch"}, c.Search.Engine), "SEARCH_ENGINE must be pg or meilisearch")
	require(c.Search.Engine != "meilisearch" || c.Search.MeilisearchHost != "", "MEILISEARCH_HOST is required when SEARCH_ENGINE=meilisearch")
	require(slices.Contains([]string{"hikarinagi"}, c.Catalog.Source), "CATALOG_SOURCE must be hikarinagi")
	require(slices.Contains([]string{"json", "text"}, c.Log.Format), "LOG_FORMAT must be json or text")
	require(c.Telemetry.SampleRate >= 0 && c.Telemetry.SampleRate <= 1, "OTEL_TRACES_SAMPLER_ARG must be between 0 and 1")
	require(c.Upload.ChunkSizeBytes > 0 && c.Upload.ChunkSizeBytes <= c.Upload.TransferLimitBytes, "FILE_UPLOAD_CHUNK_SIZE must be positive and not exceed UPLOAD_LARGE_FILE_TRANSFER_LIMIT_BYTES")
	require(c.Upload.MaxChunks > 0, "UPLOAD_LARGE_FILE_MAX_CHUNKS must be positive")
	require(c.AI.IdleTimeout > 0 && c.AI.MaxCallDuration >= c.AI.IdleTimeout, "AI_IDLE_TIMEOUT must be positive and not exceed AI_MAX_CALL_DURATION")
	require(c.AI.RequestRetentionDays > 0 && c.AI.PayloadRetentionDays > 0, "AI_REQUEST_RETENTION_DAYS and AI_PAYLOAD_RETENTION_DAYS must be positive")
	if _, err := time.LoadLocation(c.Tasks.ScheduleTimezone); err != nil {
		errs = append(errs, fmt.Errorf("SCHEDULE_TIMEZONE: %w", err))
	}
	for _, raw := range c.HTTP.TrustedProxies {
		if _, err := ParsePrefix(raw); err != nil {
			errs = append(errs, fmt.Errorf("TRUSTED_PROXIES: %w", err))
		}
	}
	for name, raw := range map[string]string{"SITE_URL": c.App.SiteURL, "OIDC_ISSUER": c.OIDC.Issuer, "HIKARINAGI_API_BASE_URL": c.Catalog.Hikarinagi.APIBaseURL, "AI_CATALOG_URL": c.AI.CatalogURL} {
		if parsed, err := url.Parse(raw); err != nil || parsed.Scheme == "" || parsed.Host == "" {
			errs = append(errs, fmt.Errorf("%s must be an absolute URL", name))
		}
	}
	if c.Telemetry.Endpoint != "" {
		if parsed, err := url.Parse(c.Telemetry.Endpoint); err != nil || parsed.Scheme == "" || parsed.Host == "" {
			errs = append(errs, errors.New("OTEL_EXPORTER_OTLP_ENDPOINT must be an absolute URL"))
		}
	}
	if _, err := parseHeaders(c.Telemetry.Headers); err != nil {
		errs = append(errs, fmt.Errorf("OTEL_EXPORTER_OTLP_HEADERS: %w", err))
	}
	for _, raw := range append(append([]string{}, c.WebAuthn.Origins...), c.OIDC.AllowedOrigins...) {
		if parsed, err := url.Parse(raw); err != nil || parsed.Scheme == "" || parsed.Host == "" || parsed.Path != "" {
			errs = append(errs, fmt.Errorf("origin %q must be a scheme://host[:port] origin", raw))
		}
	}
	if c.Email.Endpoint != "" {
		if parsed, err := url.Parse(c.Email.Endpoint); err != nil || parsed.Scheme == "" || parsed.Host == "" {
			errs = append(errs, errors.New("EMAIL_PROVIDER_ENDPOINT must be an absolute URL"))
		}
	}
	return errors.Join(errs...)
}

func (c *Config) TrustedProxyPrefixes() []netip.Prefix {
	prefixes := make([]netip.Prefix, 0, len(c.HTTP.TrustedProxies))
	for _, raw := range c.HTTP.TrustedProxies {
		if prefix, err := ParsePrefix(raw); err == nil {
			prefixes = append(prefixes, prefix)
		}
	}
	return prefixes
}

func ParsePrefix(raw string) (netip.Prefix, error) {
	if strings.Contains(raw, "/") {
		return netip.ParsePrefix(raw)
	}
	addr, err := netip.ParseAddr(raw)
	if err != nil {
		return netip.Prefix{}, err
	}
	return netip.PrefixFrom(addr, addr.BitLen()), nil
}

func (t Telemetry) ExportHeaders() map[string]string {
	headers, _ := parseHeaders(t.Headers)
	return headers
}

func parseHeaders(raw string) (map[string]string, error) {
	headers := map[string]string{}
	for pair := range strings.SplitSeq(raw, ",") {
		if strings.TrimSpace(pair) == "" {
			continue
		}
		name, value, found := strings.Cut(pair, "=")
		name = strings.TrimSpace(name)
		if !found || name == "" {
			return nil, fmt.Errorf("%q must be name=value", strings.TrimSpace(pair))
		}
		decoded, err := url.PathUnescape(value)
		if err != nil {
			return nil, fmt.Errorf("header %s: %w", name, err)
		}
		headers[name] = strings.TrimSpace(decoded)
	}
	return headers, nil
}

func trimAll(values []string) []string {
	out := make([]string, 0, len(values))
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}
