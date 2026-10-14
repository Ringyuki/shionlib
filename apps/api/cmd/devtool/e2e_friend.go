package main

import (
	"context"
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
)

type e2eFriendLink struct {
	name        string
	url         string
	logo        string
	description string
}

var e2eFriendLinks = []e2eFriendLink{
	{"KUN Visual Novel Forum", "https://www.kungal.com", "https://www.kungal.com/favicon.ico", "世界上最萌的 Galgame 论坛!"},
	{"KUN Visual Novel Patch", "https://www.moyu.moe/", "https://www.kungal.com/favicon.ico", "最先进的 Galgame 补丁资源下载站"},
	{"Nysoure", "https://nysoure.com/", "https://nysoure.com/icon-192.png", "完全免费的 galgame 分享网站"},
	{"UUZ导航 | ACG导航站", "https://www.uuznav.com/", "https://www.uuznav.com/favicon.ico", "简约美观实用的导航网站"},
	{"Singureo", "https://www.singureo.com/", "https://www.singureo.com/favicon.ico", "以用户的体验为主"},
	{"TouchGal", "https://www.touchgal.ink", "https://cloud.touchgaloss.com/2024/06/8b9411844520240614204452.webp", "一站式 Galgame 文化社区"},
	{"SakuGAL", "https://sakugal.com", "https://sakugal.com/favicon.ico", "免费galgame资源分享"},
}

func (s *e2eSeeder) seedFriendLinks(ctx context.Context, tx *ent.Client) error {
	builders := make([]*ent.FriendLinkCreate, len(e2eFriendLinks))
	for i, link := range e2eFriendLinks {
		builders[i] = tx.FriendLink.Create().
			SetName(link.name).
			SetURL(link.url).
			SetLogo(link.logo).
			SetDescription(link.description).
			SetPosition(i + 1)
	}
	if err := tx.FriendLink.CreateBulk(builders...).Exec(ctx); err != nil {
		return fmt.Errorf("seed friend links: %w", err)
	}
	return nil
}
