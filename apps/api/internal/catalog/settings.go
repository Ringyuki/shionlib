package catalog

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
)

var (
	RefreshInterval = setting.Duration(setting.Spec[time.Duration]{
		Name:        "catalog.refresh_interval",
		Label:       "条目重新同步间隔",
		Description: "距上次同步超过这么久的条目会被重新从数据源拉取。",
		Default:     7 * 24 * time.Hour, Min: time.Hour, Max: 365 * 24 * time.Hour,
	})
	RefreshBatch = setting.Int(setting.Spec[int]{
		Name:        "catalog.refresh_batch",
		Label:       "每轮重新同步条数",
		Description: "定时任务每次排队重新同步的条目数。",
		Default:     50, Min: 1, Max: 1000,
	})
	ChangesBatch = setting.Int(setting.Spec[int]{
		Name:        "catalog.changes_batch",
		Label:       "每次拉取变更条数",
		Description: "从数据源增量拉取变更时每页的条数。",
		Default:     200, Min: 1, Max: 1000,
	})
)
