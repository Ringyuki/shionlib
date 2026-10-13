package sponsor

import "github.com/Ringyuki/shionlib/apps/api/internal/setting"

var Enabled = setting.Flag(setting.Spec[bool]{
	Name:        "sponsor.enabled",
	Label:       "开放赞助",
	Description: "关闭后无法创建或支付赞助订单，已完成的订单不受影响。",
	Default:     false,
})
