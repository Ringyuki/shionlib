package animetrace

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
)

var (
	Interval = setting.Duration(setting.Spec[time.Duration]{
		Name:        "search.animetrace_interval",
		Label:       "AnimeTrace：相邻两次识图的最短间隔",
		Description: "全站发往 AnimeTrace 的识图请求排成一队，相邻两次至少相隔这么久。AnimeTrace 按来源 IP 限流，实测约每 30 秒 2 次。",
		Default:     15 * time.Second, Min: 0, Max: 10 * time.Minute,
	})
	MaxWait = setting.Duration(setting.Spec[time.Duration]{
		Name:        "search.animetrace_max_wait",
		Label:       "AnimeTrace：最长排队时间",
		Description: "识图请求排队超过这个时长仍未轮到时，提示识图服务繁忙。",
		Default:     20 * time.Second, Min: 0, Max: 2 * time.Minute,
	})
)
