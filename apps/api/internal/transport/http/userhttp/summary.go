package userhttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

type UserSummary struct {
	ID        int     `json:"id"`
	Name      string  `json:"name"`
	Avatar    *string `json:"avatar"`
	IsSponsor bool    `json:"is_sponsor"`
}

func ToUserSummary(s user.Summary, now time.Time) UserSummary {
	return UserSummary{ID: s.ID, Name: s.Name, Avatar: s.Avatar, IsSponsor: s.IsSponsor(now)}
}

func ToUserSummaryPtr(s *user.Summary, now time.Time) *UserSummary {
	if s == nil {
		return nil
	}
	summary := ToUserSummary(*s, now)
	return &summary
}
