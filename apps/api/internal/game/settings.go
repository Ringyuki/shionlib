package game

import "github.com/Ringyuki/shionlib/apps/api/internal/setting"

var (
	HotScoreViews = setting.Float(setting.Spec[float64]{
		Name:        "hot_score.views",
		Label:       "浏览量权重",
		Description: "累计浏览量（取对数）在热度中的权重。",
		Default:     0.6, Min: 0, Max: 100,
	})
	HotScoreDownloads = setting.Float(setting.Spec[float64]{
		Name:        "hot_score.downloads",
		Label:       "下载量权重",
		Description: "累计下载量（取对数）在热度中的权重。",
		Default:     1, Min: 0, Max: 100,
	})
	HotScoreRecentWindowDays = setting.Float(setting.Spec[float64]{
		Name:        "hot_score.recent_window_days",
		Label:       "近期窗口天数",
		Description: "统计近期浏览量和下载量的天数。",
		Default:     7, Min: 1, Max: 365,
	})
	HotScoreRecentViews = setting.Float(setting.Spec[float64]{
		Name:    "hot_score.recent_views",
		Label:   "近期浏览量权重",
		Default: 0.6, Min: 0, Max: 100,
	})
	HotScoreRecentDownloads = setting.Float(setting.Spec[float64]{
		Name:    "hot_score.recent_downloads",
		Label:   "近期下载量权重",
		Default: 0.9, Min: 0, Max: 100,
	})
	HotScoreRelease = setting.Float(setting.Spec[float64]{
		Name:        "hot_score.release",
		Label:       "发售新鲜度权重",
		Description: "发售时间越近的作品加分越多，加分按发售半衰期衰减。",
		Default:     0.8, Min: 0, Max: 100,
	})
	HotScoreReleaseHalfLifeDays = setting.Float(setting.Spec[float64]{
		Name:    "hot_score.release_half_life_days",
		Label:   "发售新鲜度半衰期（天）",
		Default: 30, Min: 1, Max: 3650,
	})
	HotScoreCreated = setting.Float(setting.Spec[float64]{
		Name:        "hot_score.created",
		Label:       "入库新鲜度权重",
		Description: "收录时间越近的作品加分越多，加分按入库半衰期衰减。",
		Default:     0.4, Min: 0, Max: 100,
	})
	HotScoreCreatedHalfLifeDays = setting.Float(setting.Spec[float64]{
		Name:    "hot_score.created_half_life_days",
		Label:   "入库新鲜度半衰期（天）",
		Default: 15, Min: 1, Max: 3650,
	})
)
