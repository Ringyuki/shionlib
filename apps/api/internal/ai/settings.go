package ai

import "github.com/Ringyuki/shionlib/apps/api/internal/setting"

var (
	RecordPayloads = setting.Flag(setting.Spec[bool]{
		Name:        "ai.record_payloads",
		Label:       "记录请求内容",
		Description: "保存每次 AI 调用的提示词和输出，便于排查问题；其中包含待审核的用户内容。",
		Default:     true,
	})
	RequestRetentionDays = setting.Int(setting.Spec[int]{
		Name:        "ai.request_retention_days",
		Label:       "调用记录保留天数",
		Description: "AI 调用记录（用量、费用、耗时）的保留天数。",
		Default:     90, Min: 1, Max: 3650,
	})
	PayloadRetentionDays = setting.Int(setting.Spec[int]{
		Name:        "ai.payload_retention_days",
		Label:       "请求内容保留天数",
		Description: "提示词和输出的保留天数。",
		Default:     7, Min: 1, Max: 3650,
	})
)
