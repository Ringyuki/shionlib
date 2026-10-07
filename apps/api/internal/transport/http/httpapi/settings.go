package httpapi

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
)

const (
	day  = 24 * time.Hour
	week = 7 * day
)

var (
	DefaultThrottleLimit = setting.Int(setting.Spec[int]{
		Name:        "throttle.default_limit",
		Label:       "全站限流：每窗口请求数",
		Description: "同一 IP 在一个窗口内对同一个接口最多可发送的请求数；未单独设置限制的接口均适用该限制。",
		Default:     600, Min: 1, Max: 1_000_000,
	})
	DefaultThrottleWindow = setting.Duration(setting.Spec[time.Duration]{
		Name:    "throttle.default_window",
		Label:   "全站限流：窗口长度",
		Default: time.Minute, Min: time.Second, Max: day,
	})
	DefaultThrottleBlock = setting.Duration(setting.Spec[time.Duration]{
		Name:        "throttle.default_block",
		Label:       "全站限流：超限后封禁时长",
		Description: "超过限制后，该 IP 对该接口的请求被拒绝的时长；搜索和上传分片同样适用该时长。",
		Default:     10 * time.Second, Min: 0, Max: week,
	})
	DownloadThrottleLimit = setting.Int(setting.Spec[int]{
		Name:        "throttle.download_limit",
		Label:       "下载限流：每窗口次数",
		Description: "同一 IP 在一个窗口内最多可获取的下载链接数。",
		Default:     60, Min: 1, Max: 100_000,
	})
	DownloadThrottleWindow = setting.Duration(setting.Spec[time.Duration]{
		Name:    "throttle.download_window",
		Label:   "下载限流：窗口长度",
		Default: time.Hour, Min: time.Second, Max: week,
	})
	DownloadThrottleBlock = setting.Duration(setting.Spec[time.Duration]{
		Name:    "throttle.download_block",
		Label:   "下载限流：超限后封禁时长",
		Default: 12 * time.Hour, Min: 0, Max: 30 * day,
	})
	AuthThrottleLimit = setting.Int(setting.Spec[int]{
		Name:        "throttle.auth_limit",
		Label:       "登录限流：每窗口次数",
		Description: "登录、注册、验证码、找回密码、修改邮箱和修改密码等接口，同一 IP 在一个窗口内最多可尝试的次数。",
		Default:     20, Min: 1, Max: 1_000_000,
	})
	AuthThrottleWindow = setting.Duration(setting.Spec[time.Duration]{
		Name:    "throttle.auth_window",
		Label:   "登录限流：窗口长度",
		Default: 10 * time.Minute, Min: time.Second, Max: day,
	})
	AuthThrottleBlock = setting.Duration(setting.Spec[time.Duration]{
		Name:    "throttle.auth_block",
		Label:   "登录限流：超限后封禁时长",
		Default: 10 * time.Minute, Min: 0, Max: week,
	})
	SearchThrottleLimit = setting.Int(setting.Spec[int]{
		Name:        "throttle.search_limit",
		Label:       "搜索限流：每窗口次数",
		Description: "同一 IP 在一个窗口内最多可发送的搜索请求数。",
		Default:     120, Min: 1, Max: 1_000_000,
	})
	SearchThrottleWindow = setting.Duration(setting.Spec[time.Duration]{
		Name:    "throttle.search_window",
		Label:   "搜索限流：窗口长度",
		Default: time.Minute, Min: time.Second, Max: day,
	})
	UploadChunkThrottleLimit = setting.Int(setting.Spec[int]{
		Name:        "throttle.upload_chunk_limit",
		Label:       "上传分片限流：每窗口次数",
		Description: "同一 IP 在一个窗口内最多可上传的分片数。",
		Default:     10_000, Min: 1, Max: 1_000_000,
	})
	UploadChunkThrottleWindow = setting.Duration(setting.Spec[time.Duration]{
		Name:    "throttle.upload_chunk_window",
		Label:   "上传分片限流：窗口长度",
		Default: time.Minute, Min: time.Second, Max: day,
	})
)
