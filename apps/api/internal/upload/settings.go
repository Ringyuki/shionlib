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
		Description: "管理员不受这个限制。",
		Default:     20 * gib, Min: mib, Max: 64 * tib,
	})
	SessionTTL = setting.Duration(setting.Spec[time.Duration]{
		Name:        "upload.session_ttl",
		Label:       "上传会话有效期",
		Description: "过期仍未完成的上传会被清理，占用的配额退回。",
		Default:     day, Min: time.Hour, Max: 30 * day,
	})
	QuotaBase = setting.Bytes(setting.Spec[int64]{
		Name:        "upload.quota_base",
		Label:       "初始配额",
		Description: "上传者第一次获得的配额，也是不活跃回收的下限。",
		Default:     5 * gib, Min: 0, Max: 64 * tib,
	})
	QuotaCap = setting.Bytes(setting.Spec[int64]{
		Name:        "upload.quota_cap",
		Label:       "动态配额上限",
		Description: "自动增加的配额最多加到这个值。",
		Default:     20 * gib, Min: 0, Max: 64 * tib,
	})
	QuotaTopupStep = setting.Bytes(setting.Spec[int64]{
		Name:        "upload.quota_topup_step",
		Label:       "自动增加步长",
		Description: "本月有资源通过审核、剩余配额低于阈值时，每次增加的配额。",
		Default:     2 * gib, Min: 0, Max: tib,
	})
	QuotaTopupThreshold = setting.Bytes(setting.Spec[int64]{
		Name:        "upload.quota_topup_threshold",
		Label:       "自动增加阈值",
		Description: "剩余配额低于这个值时才会自动增加。",
		Default:     5 * gib / 2, Min: 0, Max: tib,
	})
	QuotaReduceStep = setting.Bytes(setting.Spec[int64]{
		Name:        "upload.quota_reduce_step",
		Label:       "不活跃回收步长",
		Description: "长期没有资源通过审核时每次回收的配额，设为 0 不回收。",
		Default:     gib, Min: 0, Max: tib,
	})
	QuotaReduceInactiveDays = setting.Int(setting.Spec[int]{
		Name:        "upload.quota_reduce_inactive_days",
		Label:       "不活跃回收天数",
		Description: "连续这么多天没有资源通过审核才开始回收，设为 0 不回收。",
		Default:     45, Min: 0, Max: 3650,
	})
	QuotaGrantAfterDays = setting.Int(setting.Spec[int]{
		Name:        "upload.quota_grant_after_days",
		Label:       "初始配额等待天数",
		Description: "注册满这么多天的用户才会获得初始配额。",
		Default:     7, Min: 0, Max: 3650,
	})
	QuotaLongestInactiveDays = setting.Int(setting.Spec[int]{
		Name:        "upload.quota_longest_inactive_days",
		Label:       "长期未登录清零天数",
		Description: "超过这么多天没有登录的上传者，配额清零。",
		Default:     120, Min: 1, Max: 3650,
	})
)
