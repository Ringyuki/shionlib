package auth

import "github.com/Ringyuki/shionlib/apps/api/internal/setting"

var (
	OIDCClientID = setting.Text(setting.Spec[string]{
		Name:        "oidc.client_id",
		Label:       "Hikarinagi ID 客户端 ID",
		Description: "「使用 Hikarinagi ID 登录」所用的客户端。留空时使用环境变量 OIDC_CLIENT_ID 的值。",
		MaxLength:   200,
	})
	OIDCClientSecret = setting.Secret(setting.Spec[string]{
		Name:        "oidc.client_secret",
		Label:       "Hikarinagi ID 客户端密钥",
		Description: "与客户端 ID 对应的密钥。未设置时使用环境变量 OIDC_CLIENT_SECRET 的值。",
		MaxLength:   500,
	})
)
