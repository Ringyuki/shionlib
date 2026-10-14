package indexing

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
)

var Enabled = setting.Flag(setting.Spec[bool]{
	Name:        "indexing.enabled",
	Label:       "向搜索引擎推送地址",
	Description: "开启后，资源和攻略发布、修改或删除时，每十分钟把对应的中文页面地址通过 IndexNow 推送给 Bing 等搜索引擎一次。",
	Default:     false,
})
