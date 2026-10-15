package walkthrough

import "github.com/Ringyuki/shionlib/apps/api/internal/setting"

var FormatDailyLimit = setting.Int(setting.Spec[int]{
	Name:        "walkthrough.format_daily_limit",
	Label:       "从文本整理：每人每天的次数",
	Description: "每位用户每天最多用 AI 整理多少次攻略原文，按北京时间计日；设为 0 时停用。",
	Default:     20, Min: 0, Max: 1000,
})
