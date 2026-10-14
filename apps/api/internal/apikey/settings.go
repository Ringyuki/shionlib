package apikey

import "github.com/Ringyuki/shionlib/apps/api/internal/setting"

var (
	Enabled = setting.Flag(setting.Spec[bool]{
		Name:        "open.enabled",
		Label:       "开放接口",
		Description: "关闭后所有 API 密钥的请求返回 503，用户不能创建新的 API 密钥；已有的密钥保留。",
		Default:     true,
	})
	MaxKeys = setting.Int(setting.Spec[int]{
		Name:        "open.max_keys",
		Label:       "每个账号的 API 密钥数量上限",
		Description: "达到上限后不能再创建；调低时已有的密钥保留。",
		Default:     10, Min: 1, Max: 100,
	})
)
