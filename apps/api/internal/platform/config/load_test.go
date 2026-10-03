package config

import (
	"strings"
	"testing"
)

func base() map[string]string {
	return map[string]string{
		"DATABASE_URL":         "postgres://localhost/db",
		"TOKEN_SECRET":         "a-very-long-test-secret",
		"REFRESH_TOKEN_PEPPER": "pepper",
		"AI_KEY_SECRET":        "offline-ai-key-secret-at-least-32-chars",
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
		"zero challenge ttl":         {"WEBAUTHN_CHALLENGE_TTL": "0s"},
		"relative email endpoint":    {"EMAIL_PROVIDER_ENDPOINT": "/v2/email/send"},
		"unknown email provider":     {"EMAIL_PROVIDER": "smtp"},
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
