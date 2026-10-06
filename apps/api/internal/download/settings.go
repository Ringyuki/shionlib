package download

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
)

var (
	LinkExpiresIn = setting.Duration(setting.Spec[time.Duration]{
		Name:        "download.link_expires_in",
		Label:       "下载链接基础有效期",
		Description: "每个下载链接至少有效这么久，再按文件大小和预估速度延长。",
		Default:     time.Hour, Min: time.Minute, Max: 7 * 24 * time.Hour,
	})
	EstimatedSpeed = setting.Bytes(setting.Spec[int64]{
		Name:        "download.estimated_speed",
		Label:       "预估下载速度（字节/秒）",
		Description: "文件大小除以这个速度，就是链接在基础有效期之外延长的时间。",
		Default:     1 << 20, Min: 1 << 10, Max: 10 << 30,
	})
	LinkMaxExpiresIn = setting.Duration(setting.Spec[time.Duration]{
		Name:        "download.link_max_expires_in",
		Label:       "下载链接最长有效期",
		Description: "延长后的有效期不超过这个值；走下载代理时也是票据的硬性过期时间。",
		Default:     24 * time.Hour, Min: time.Minute, Max: 30 * 24 * time.Hour,
	})
	MaxConns = setting.Int(setting.Spec[int]{
		Name:        "download.max_conns",
		Label:       "单个下载最多连接数",
		Description: "走下载代理时，同一个下载链接允许的并发连接数。",
		Default:     8, Min: 1, Max: 64,
	})
)
