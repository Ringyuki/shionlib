package scan

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
)

const day = 24 * time.Hour

var (
	ReviewTimeout = setting.Duration(setting.Spec[time.Duration]{
		Name:        "scan.review_timeout",
		Label:       "报毒文件复核时限",
		Description: "扫描报毒的文件需要管理员在这段时间内复核，超时没有处理就自动删除。",
		Default:     day, Min: time.Hour, Max: 30 * day,
	})
	AutoBanThreshold = setting.Int(setting.Spec[int]{
		Name:        "scan.auto_ban_threshold",
		Label:       "自动封禁次数",
		Description: "上传者第几次被确认上传有害文件时自动封禁。",
		Default:     3, Min: 1, Max: 100,
	})
	AutoBanDays = setting.Int(setting.Spec[int]{
		Name:    "scan.auto_ban_days",
		Label:   "自动封禁天数",
		Default: 30, Min: 1, Max: 3650,
	})
	IncompleteSetTimeout = setting.Duration(setting.Spec[time.Duration]{
		Name:        "scan.incomplete_set_timeout",
		Label:       "分卷补传等待时长",
		Description: "分卷压缩包缺卷时等待上传者补传的时长，超时仍不全就整组移除并退还配额。",
		Default:     day, Min: time.Hour, Max: 30 * day,
	})
	AutoDeleteNote = setting.Text(setting.Spec[string]{
		Name:        "scan.auto_delete_note",
		Label:       "超时删除说明",
		Description: "复核超时自动删除时，写进记录并通知上传者的说明。",
		Default:     "Auto delete due to review timeout",
		MaxLength:   500,
	})
)
