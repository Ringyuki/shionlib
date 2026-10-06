package upload

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
)

const (
	mib = int64(1) << 20
	gib = int64(1) << 30
	tib = int64(1) << 40
	day = 24 * time.Hour
)

var (
	ChunkSize = setting.Bytes(setting.Spec[int64]{
		Name:        "upload.chunk_size",
		Label:       "默认分片大小",
		Description: "客户端没有指定分片大小时使用，超过单个分片上限时按上限算。",
		Default:     50 * mib, Min: mib, Max: gib,
	})
	ChunkLimit = setting.Bytes(setting.Spec[int64]{
		Name:        "upload.chunk_limit",
		Label:       "单个分片上限",
		Description: "一次分片请求最多能传的字节数。",
		Default:     100 * mib, Min: mib, Max: gib,
	})
	MaxChunks = setting.Int(setting.Spec[int]{
		Name:    "upload.max_chunks",
		Label:   "单个文件最多分片数",
		Default: 10_000, Min: 1, Max: 1_000_000,
	})
	MaxFileSize = setting.Bytes(setting.Spec[int64]{
		Name:        "upload.max_file_size",
		Label:       "单个文件大小上限",
		Description: "新上传者和普通上传者的单个文件上限，可信档和管理员不受限制。",
		Default:     30 * gib, Min: mib, Max: 64 * tib,
	})
	SessionTTL = setting.Duration(setting.Spec[time.Duration]{
		Name:        "upload.session_ttl",
		Label:       "上传会话有效期",
		Description: "过期仍未完成的上传会被清理，占用的配额退回。",
		Default:     day, Min: time.Hour, Max: 30 * day,
	})
	NewUploaderQuota = setting.Bytes(setting.Spec[int64]{
		Name:        "upload.new_uploader_quota",
		Label:       "新上传者存储上限",
		Description: "还没有足够已发布资源的上传者，名下文件加上进行中的上传最多占用的空间。",
		Default:     50 * gib, Min: gib, Max: 64 * tib,
	})
	RegularQuota = setting.Bytes(setting.Spec[int64]{
		Name:    "upload.regular_quota",
		Label:   "普通上传者存储上限",
		Default: 300 * gib, Min: gib, Max: 64 * tib,
	})
	TrustedQuota = setting.Bytes(setting.Spec[int64]{
		Name:        "upload.trusted_quota",
		Label:       "可信上传者存储上限",
		Description: "可信上传者不受单个文件大小上限限制。",
		Default:     2 * tib, Min: gib, Max: 64 * tib,
	})
	RegularAfter = setting.Int(setting.Spec[int]{
		Name:        "upload.regular_after",
		Label:       "升为普通档所需已发布资源数",
		Description: "还要求最近一段时间内没有违规，见“普通档无违规时长”。",
		Default:     3, Min: 1, Max: 10_000,
	})
	TrustedAfter = setting.Int(setting.Spec[int]{
		Name:        "upload.trusted_after",
		Label:       "升为可信档所需已发布资源数",
		Description: "管理员也可以直接授予可信档。",
		Default:     30, Min: 1, Max: 100_000,
	})
	ViolationWindow = setting.Duration(setting.Spec[time.Duration]{
		Name:        "upload.violation_window",
		Label:       "普通档无违规时长",
		Description: "这段时间内有违规（确认的病毒或成立的举报）就不算普通档。",
		Default:     90 * day, Min: day, Max: 365 * day,
	})
	ViolationFreeze = setting.Duration(setting.Spec[time.Duration]{
		Name:        "upload.violation_freeze",
		Label:       "违规降档时长",
		Description: "违规后在这段时间内降一档。",
		Default:     30 * day, Min: day, Max: 365 * day,
	})
	InFlightLimit = setting.Bytes(setting.Spec[int64]{
		Name:        "upload.in_flight_limit",
		Label:       "每人进行中上传上限",
		Description: "一个人正在上传、以及传完还没发布成资源的文件加起来的上限，保护服务器暂存盘。",
		Default:     30 * gib, Min: gib, Max: tib,
	})
	SpoolReserve = setting.Bytes(setting.Spec[int64]{
		Name:        "upload.spool_reserve",
		Label:       "暂存盘保留空间",
		Description: "扣掉所有进行中上传还没写完的部分后，暂存盘至少要留出这么多空间，不够时暂停接受新的上传。",
		Default:     20 * gib, Min: 0, Max: tib,
	})
)
