package download

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
)

var (
	MaxFilesPerResource = setting.Int(setting.Spec[int]{
		Name:        "download.max_files_per_resource",
		Label:       "单个资源的文件数上限",
		Description: "单个资源最多可包含的文件数量，分卷计入其中。",
		Default:     100, Min: 1, Max: 1000,
	})
	IncompleteSetTimeout = setting.Duration(setting.Spec[time.Duration]{
		Name:        "scan.incomplete_set_timeout",
		Label:       "等待补齐分卷的时长",
		Description: "分卷压缩包缺少分卷时，等待上传者补充上传的时长。超时后仍不完整的，整组文件将被移除。",
		Default:     24 * time.Hour, Min: time.Hour, Max: 30 * 24 * time.Hour,
	})
	LinkExpiresIn = setting.Duration(setting.Spec[time.Duration]{
		Name:        "download.link_expires_in",
		Label:       "下载链接基础有效期",
		Description: "下载链接的最短有效期，实际有效期会根据文件大小和预估速度延长。",
		Default:     time.Hour, Min: time.Minute, Max: 7 * 24 * time.Hour,
	})
	EstimatedSpeed = setting.Bytes(setting.Spec[int64]{
		Name:        "download.estimated_speed",
		Label:       "预估下载速度（字节/秒）",
		Description: "链接在基础有效期之外延长的时间，等于文件大小除以该速度。",
		Default:     1 << 20, Min: 1 << 10, Max: 10 << 30,
	})
	LinkMaxExpiresIn = setting.Duration(setting.Spec[time.Duration]{
		Name:        "download.link_max_expires_in",
		Label:       "下载链接最长有效期",
		Description: "延长后的有效期不超过该值；使用下载代理时，该值同时是票据的强制过期时间。",
		Default:     24 * time.Hour, Min: time.Minute, Max: 30 * 24 * time.Hour,
	})
	MaxConns = setting.Int(setting.Spec[int]{
		Name:        "download.max_conns",
		Label:       "单个下载的连接数上限",
		Description: "使用下载代理时，同一个下载链接允许的并发连接数。",
		Default:     8, Min: 1, Max: 64,
	})
)
