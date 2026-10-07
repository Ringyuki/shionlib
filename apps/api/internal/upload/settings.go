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
		Description: "客户端未指定分片大小时使用该值；超过单个分片上限时，按上限计算。",
		Default:     50 * mib, Min: mib, Max: gib,
	})
	ChunkLimit = setting.Bytes(setting.Spec[int64]{
		Name:        "upload.chunk_limit",
		Label:       "单个分片上限",
		Description: "单次分片请求最多可上传的字节数。",
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
		Description: "新上传者和普通上传者的单个文件上限，可信上传者和管理员不受限制。",
		Default:     30 * gib, Min: mib, Max: 64 * tib,
	})
	SessionTTL = setting.Duration(setting.Spec[time.Duration]{
		Name:        "upload.session_ttl",
		Label:       "上传会话有效期",
		Description: "上传未在该时长内完成即视为过期，已上传的部分将被清理。",
		Default:     day, Min: time.Hour, Max: 30 * day,
	})
	NewUploaderQuota = setting.Bytes(setting.Spec[int64]{
		Name:        "upload.new_uploader_quota",
		Label:       "新上传者存储上限",
		Description: "已发布资源数量尚未达到要求的上传者，其已存储的文件与进行中的上传合计可占用的最大空间。",
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
		Label:       "升为普通上传者所需已发布资源数",
		Description: "同时要求在一定时间内没有违规，参见“违规后不能升级的时长”。",
		Default:     3, Min: 1, Max: 10_000,
	})
	TrustedAfter = setting.Int(setting.Spec[int]{
		Name:        "upload.trusted_after",
		Label:       "升为可信上传者所需已发布资源数",
		Description: "管理员也可以直接将用户设为可信上传者。",
		Default:     30, Min: 1, Max: 100_000,
	})
	ViolationWindow = setting.Duration(setting.Spec[time.Duration]{
		Name:        "upload.violation_window",
		Label:       "违规后不能升级的时长",
		Description: "在该时长内有过违规（确认上传了病毒，或被举报且举报成立）的上传者，仅按新上传者计算。",
		Default:     90 * day, Min: day, Max: 365 * day,
	})
	ViolationFreeze = setting.Duration(setting.Spec[time.Duration]{
		Name:        "upload.violation_freeze",
		Label:       "违规后降级的时长",
		Description: "上传者违规后，在该时长内按低一级的上传者计算。",
		Default:     30 * day, Min: day, Max: 365 * day,
	})
	InFlightLimit = setting.Bytes(setting.Spec[int64]{
		Name:        "upload.in_flight_limit",
		Label:       "每人同时上传的总大小上限",
		Description: "单个用户正在上传的文件总大小不能超过该值。已上传完成但尚未添加到资源中的文件不计入其中，而是计入存储上限。",
		Default:     30 * gib, Min: gib, Max: tib,
	})
	SpoolReserve = setting.Bytes(setting.Spec[int64]{
		Name:        "upload.spool_reserve",
		Label:       "暂存盘保留空间",
		Description: "扣除正在上传的文件尚未写入的部分后，暂存盘至少需要保留的空间。空间不足时，不再接受新的上传，检查文件时也不进行解压。",
		Default:     20 * gib, Min: 0, Max: tib,
	})
)
