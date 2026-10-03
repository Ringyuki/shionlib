package bootstrap

import (
	"fmt"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/argon2hash"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/imaging"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/objectstore"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/oidcprovider"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/passkey"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/authpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/userpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/redis/authredis"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
	"github.com/Ringyuki/shionlib/apps/api/internal/media"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/httpclient"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/jobs"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/authhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/mediahttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/userhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

func wireAuth(infra *Infra, shared *Shared, modules *Modules) {
	cfg := shared.Config
	accounts := userpg.NewRepository(infra.Ent)
	credentials := authpg.NewRepository(infra.Ent)
	store := authredis.NewStore(infra.Redis)
	passwords := argon2hash.New(argon2hash.PasswordParams())
	mailer := shared.Mailer

	sessions := auth.NewSessions(credentials, accounts, shared.Tokens, argon2hash.New(argon2hash.RefreshTokenParams()), shared.Families, store, shared.Transactor, infra.Now, auth.SessionPolicy{
		Version:       cfg.Token.RefreshAlgorithmVersion,
		Pepper:        cfg.Token.RefreshPepper,
		AccessTTL:     cfg.Token.ExpiresIn,
		ShortWindow:   cfg.Token.RefreshShortWindow,
		LongWindow:    cfg.Token.RefreshLongWindow,
		RotationGrace: cfg.Token.RefreshRotationGrace,
		ReplayWait:    auth.DefaultReplayWait,
		ReplayPoll:    auth.DefaultReplayPoll,
	})
	codes := auth.NewCodes(store, mailer, infra.Now)
	ceremony, err := passkey.New(passkey.Settings{RPID: cfg.WebAuthn.RPID, RPName: cfg.WebAuthn.RPName, Origins: cfg.WebAuthn.Origins, Timeout: cfg.WebAuthn.Timeout})
	if err != nil {
		panic(fmt.Errorf("wire passkeys: %w", err))
	}
	identityProvider := oidcprovider.New(oidcprovider.Settings{
		Issuer:       cfg.OIDC.Issuer,
		ClientID:     cfg.OIDC.ClientID,
		ClientSecret: cfg.OIDC.ClientSecret,
		Scopes:       cfg.OIDC.Scopes,
	}, httpclient.New(httpclient.Options{Timeout: 10 * time.Second}), infra.Now)
	images := media.NewService(imaging.NewProcessor(), objectstore.New(objectstore.Options{
		Bucket:          cfg.Storage.Image.Bucket,
		Region:          cfg.Storage.Image.Region,
		Endpoint:        cfg.Storage.Image.Endpoint,
		AccessKeyID:     cfg.Storage.Image.AccessKeyID,
		SecretAccessKey: cfg.Storage.Image.SecretAccessKey,
		PathStyle:       cfg.Storage.Image.ForcePathStyle,
		HTTPClient:      httpclient.New(httpclient.Options{Timeout: 30 * time.Second}),
	}), nil)
	profiles := user.NewService(accounts, shared.Transactor, sessions, codes, passwords, images, infra.Now, user.Policy{AllowRegister: cfg.App.AllowRegister})

	modules.Handlers = append(modules.Handlers,
		authhttp.NewHandler(authhttp.Services{
			Sessions: sessions,
			Login:    auth.NewPasswordLogin(accounts, passwords, sessions, infra.Now),
			Codes:    codes,
			Reset:    auth.NewPasswordReset(accounts, store, mailer, passwords, sessions, shared.Transactor, cfg.App.SiteURL),
			Passkeys: auth.NewPasskeys(accounts, credentials, ceremony, store, sessions, shared.Transactor, infra.Now, cfg.WebAuthn.ChallengeTTL),
			OIDC:     auth.NewOIDC(identityProvider, credentials, credentials, accounts, sessions, shared.Transactor, infra.Now, cfg.OIDC.AllowedOrigins),
		}, authhttp.CookiePolicy{Secure: cfg.Token.CookieSecure, AccessMaxAge: cfg.Token.ExpiresIn, RefreshMaxAge: cfg.Token.RefreshShortWindow}, shared.Builder, shared.Logger),
		userhttp.NewHandler(profiles, user.NewEditHistory(userpg.NewEditRecordStore(infra.Ent)), shared.Builder),
		mediahttp.NewHandler(images, shared.Builder),
	)
	modules.Jobs.Tasks = append(modules.Jobs.Tasks,
		jobs.Task{Name: "auth_session_cleanup", Schedule: "0 3 * * *", Timeout: 10 * time.Minute, Run: sessions.CleanupStale},
		jobs.Task{Name: "user_unban_expired", Schedule: "* * * * *", Timeout: time.Minute, Run: profiles.UnbanExpired},
	)
}
