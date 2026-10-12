package scan

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
)

const day = 24 * time.Hour

var (
	ReviewTimeout = setting.Duration(setting.Spec[time.Duration]{
		Name:        "scan.review_timeout",
		Label:       "疑似病毒文件复核时限",
		Description: "扫描发现疑似病毒的文件后，管理员需要在该时限内复核；超时未处理的文件将被自动删除。",
		Default:     day, Min: time.Hour, Max: 30 * day,
	})
	AutoBanThreshold = setting.Int(setting.Spec[int]{
		Name:        "scan.auto_ban_threshold",
		Label:       "自动封禁次数",
		Description: "上传者被确认上传有害文件达到该次数时，自动封禁。",
		Default:     3, Min: 1, Max: 100,
	})
	AutoBanDays = setting.Int(setting.Spec[int]{
		Name:    "scan.auto_ban_days",
		Label:   "自动封禁天数",
		Default: 30, Min: 1, Max: 3650,
	})
	IncompleteSetTimeout = setting.Duration(setting.Spec[time.Duration]{
		Name:        "scan.incomplete_set_timeout",
		Label:       "等待补齐分卷的时长",
		Description: "分卷压缩包缺少分卷时，等待上传者补充上传的时长。超时后仍不完整的，整组文件将被移除。",
		Default:     day, Min: time.Hour, Max: 30 * day,
	})
	CheckAttempts = setting.Int(setting.Spec[int]{
		Name:        "scan.check_attempts",
		Label:       "检查失败的次数上限",
		Description: "一个文件的检查失败后会隔一段时间重试，间隔逐次加倍。连续失败达到该次数时暂停重试，通知上传者和管理员，等待管理员处理。",
		Default:     6, Min: 1, Max: 50,
	})
	StalledCheckTimeout = setting.Duration(setting.Spec[time.Duration]{
		Name:        "scan.stalled_check_timeout",
		Label:       "暂停检查的文件保留时长",
		Description: "检查暂停后，管理员需要在该时长内让文件重新检查；超时仍未处理的文件将被判为未通过并移除。",
		Default:     7 * day, Min: time.Hour, Max: 90 * day,
	})
	AutoDeleteNote = setting.Text(setting.Spec[string]{
		Name:        "scan.auto_delete_note",
		Label:       "超时删除说明",
		Description: "复核超时自动删除时，写入记录并通知上传者的说明文字。",
		Default:     "Auto delete due to review timeout",
		MaxLength:   500,
	})
)
