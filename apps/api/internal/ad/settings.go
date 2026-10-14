package ad

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
)

var Enabled = setting.Flag(setting.Spec[bool]{
	Name:        "ad.enabled",
	Label:       "开启广告",
	Description: "关闭后全站不显示广告。",
	Default:     true,
})
