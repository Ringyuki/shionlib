package auth_test

import (
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
)

func TestOIDCCredentialsPreferTheSettingsAndFallBackPerField(t *testing.T) {
	fallback := auth.ClientCredentials{ID: "env-id", Secret: "env-secret"}
	source := settingtest.Source{}
	if got := auth.OIDCCredentials(source, fallback); got != fallback {
		t.Fatalf("nothing set: %+v", got)
	}
	settingtest.Set(source, auth.OIDCClientSecret, "panel-secret")
	if got := auth.OIDCCredentials(source, fallback); got != (auth.ClientCredentials{ID: "env-id", Secret: "panel-secret"}) {
		t.Fatalf("only the secret set: %+v", got)
	}
	settingtest.Set(source, auth.OIDCClientID, "panel-id")
	if got := auth.OIDCCredentials(source, fallback); got != (auth.ClientCredentials{ID: "panel-id", Secret: "panel-secret"}) {
		t.Fatalf("both set: %+v", got)
	}
}
