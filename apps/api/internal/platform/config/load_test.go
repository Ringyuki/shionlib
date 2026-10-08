package config

import (
	"strings"
	"testing"
)

func base() map[string]string {
	return map[string]string{
		"DATABASE_URL":           "postgres://localhost/db",
		"TOKEN_SECRET":           "a-very-long-test-secret",
		"REFRESH_TOKEN_PEPPER":   "pepper",
		"EMAIL_PROVIDER_API_KEY": "email-key",
		"EMAIL_SENDER_ADDRESS":   "noreply@shionlib.com",
	}
}

func TestDefaultsAreValid(t *testing.T) {
	cfg, err := LoadFrom(base())
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Token.CookieSecure != true || cfg.Storage.Image.ForcePathStyle || len(cfg.WebAuthn.Origins) != 1 || len(cfg.OIDC.AllowedOrigins) != 1 {
		t.Fatalf("unexpected defaults %+v %+v %+v", cfg.Token, cfg.WebAuthn, cfg.OIDC)
	}
}

func TestAuthSettingsAreValidated(t *testing.T) {
	cases := map[string]map[string]string{
		"origin with a path":         {"WEBAUTHN_ORIGINS": "https://shionlib.com/app"},
		"relative oidc origin":       {"OIDC_ALLOWED_ORIGINS": "shionlib.com"},
		"negative rotation grace":    {"REFRESH_TOKEN_ROTATION_GRACE": "-1s"},
		"refresh window too short":   {"REFRESH_TOKEN_SHORT_WINDOW": "300s"},
		"zero challenge ttl":         {"WEBAUTHN_CHALLENGE_TTL": "0s"},
		"relative email endpoint":    {"EMAIL_PROVIDER_ENDPOINT": "/v2/email/send"},
		"unknown email provider":     {"EMAIL_PROVIDER": "smtp"},
		"no email key in production": {"EMAIL_PROVIDER_API_KEY": ""},
		"no email sender address":    {"EMAIL_SENDER_ADDRESS": ""},
		"postal without endpoint":    {"EMAIL_PROVIDER": "postal"},
		"refresh version with a dot": {"REFRESH_TOKEN_ALGORITHM_VERSION": "slrt.1"},
	}
	for name, overrides := range cases {
		env := base()
		for key, value := range overrides {
			env[key] = value
		}
		if _, err := LoadFrom(env); err == nil {
			t.Errorf("%s: expected a validation error", name)
		}
	}
	env := base()
	env["WEBAUTHN_ORIGINS"] = "https://shionlib.com, https://shionlib.org"
	env["S3_IMAGE_FORCE_PATH_STYLE"] = "true"
	cfg, err := LoadFrom(env)
	if err != nil || strings.Join(cfg.WebAuthn.Origins, "|") != "https://shionlib.com|https://shionlib.org" || !cfg.Storage.Image.ForcePathStyle {
		t.Fatalf("valid settings rejected: %v %+v", err, cfg)
	}
}

func TestTelemetrySettingsAreValidated(t *testing.T) {
	cases := map[string]map[string]string{
		"relative endpoint":     {"OTEL_EXPORTER_OTLP_ENDPOINT": "/otlp"},
		"header without value":  {"OTEL_EXPORTER_OTLP_HEADERS": "Authorization"},
		"header without name":   {"OTEL_EXPORTER_OTLP_HEADERS": "=token"},
		"sample rate above one": {"OTEL_TRACES_SAMPLER_ARG": "1.5"},
	}
	for name, overrides := range cases {
		env := base()
		for key, value := range overrides {
			env[key] = value
		}
		if _, err := LoadFrom(env); err == nil {
			t.Errorf("%s: expected a validation error", name)
		}
	}
}

func TestTelemetryHeadersArePercentDecoded(t *testing.T) {
	env := base()
	env["OTEL_EXPORTER_OTLP_ENDPOINT"] = "https://otlp.example.com"
	env["OTEL_EXPORTER_OTLP_HEADERS"] = "Authorization=Bearer%20token, X-Scope-OrgID = shionlib ,"
	cfg, err := LoadFrom(env)
	if err != nil {
		t.Fatal(err)
	}
	headers := cfg.Telemetry.ExportHeaders()
	if len(headers) != 2 || headers["Authorization"] != "Bearer token" || headers["X-Scope-OrgID"] != "shionlib" {
		t.Fatalf("headers %v", headers)
	}
}

func TestCatalogSettingsAreValidated(t *testing.T) {
	for name, overrides := range map[string]map[string]string{
		"no import workers":   {"CATALOG_IMPORT_WORKERS": "0"},
		"no request budget":   {"HIKARINAGI_REQUESTS_PER_MINUTE": "0"},
		"unknown source name": {"CATALOG_SOURCE": "vndb"},
	} {
		env := base()
		for key, value := range overrides {
			env[key] = value
		}
		if _, err := LoadFrom(env); err == nil {
			t.Errorf("%s: expected a validation error", name)
		}
	}
	env := base()
	env["CATALOG_IMPORT_WORKERS"] = "8"
	cfg, err := LoadFrom(env)
	if err != nil || cfg.Catalog.ImportWorkers != 8 {
		t.Fatalf("import workers %+v %v", cfg, err)
	}
}

func TestEmailSettingsAreOptionalOutsideProduction(t *testing.T) {
	env := base()
	env["APP_ENV"] = "development"
	env["EMAIL_PROVIDER_API_KEY"] = ""
	env["EMAIL_SENDER_ADDRESS"] = ""
	if _, err := LoadFrom(env); err != nil {
		t.Fatalf("development may run without mail: %v", err)
	}
}
