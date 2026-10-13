package idatariver

import "github.com/Ringyuki/shionlib/apps/api/internal/setting"

var (
	BaseURL = setting.Text(setting.Spec[string]{
		Name:        "payment.idatariver_base_url",
		Label:       "iDataRiver 接口地址",
		Description: "iDataRiver 开放接口的地址。留空时使用官方地址。",
		Default:     DefaultBaseURL,
		MaxLength:   200,
	})
	ProjectID = setting.Text(setting.Spec[string]{
		Name:        "payment.idatariver_project_id",
		Label:       "iDataRiver 项目 ID",
		Description: "收取赞助所用的 iDataRiver 项目。项目 ID 与开发者密钥都填写后才能创建赞助订单。",
		MaxLength:   200,
	})
	Secret = setting.Secret(setting.Spec[string]{
		Name:        "payment.idatariver_secret",
		Label:       "iDataRiver 开发者密钥",
		Description: "调用 iDataRiver 开放接口所用的密钥。",
		MaxLength:   500,
	})
)
