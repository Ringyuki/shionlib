package game_test

import (
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
)

func TestBangumiCredentialsPreferTheSettingsAndFallBackPerField(t *testing.T) {
	source := settingtest.Source{}
	if id, secret := game.BangumiCredentials(source, "env-id", "env-secret"); id != "env-id" || secret != "env-secret" {
		t.Fatalf("nothing set: %s %s", id, secret)
	}
	settingtest.Set(source, game.BangumiClientID, "panel-id")
	if id, secret := game.BangumiCredentials(source, "env-id", "env-secret"); id != "panel-id" || secret != "env-secret" {
		t.Fatalf("only the id set: %s %s", id, secret)
	}
	settingtest.Set(source, game.BangumiClientSecret, "panel-secret")
	if id, secret := game.BangumiCredentials(source, "env-id", "env-secret"); id != "panel-id" || secret != "panel-secret" {
		t.Fatalf("both set: %s %s", id, secret)
	}
}
