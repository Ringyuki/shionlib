package user

import "github.com/Ringyuki/shionlib/apps/api/internal/setting"

var AllowRegister = setting.Flag(setting.Spec[bool]{
	Name:        "user.allow_register",
	Label:       "开放注册",
	Description: "关闭后新用户无法注册，已有账号照常登录。",
	Default:     true,
})
