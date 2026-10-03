package adminpg

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/admin"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

func toBan(row *ent.UserBannedRecord) *admin.BanRecord {
	ban := &admin.BanRecord{
		BannedAt:     row.BannedAt,
		Reason:       row.BannedReason,
		DurationDays: row.BannedDurationDays,
		Permanent:    row.IsPermanent,
		UnbannedAt:   row.UnbannedAt,
	}
	if by := row.Edges.BannedByUser; by != nil {
		ban.BannedBy = &admin.UserRef{ID: by.ID, Name: by.Name}
	}
	return ban
}

func toEntry(row *ent.User, counts admin.Counts) admin.UserEntry {
	return admin.UserEntry{
		ID:               row.ID,
		Name:             row.Name,
		Email:            row.Email,
		Avatar:           row.Avatar,
		Role:             actor.Role(row.Role),
		Status:           user.Status(row.Status),
		Lang:             user.Lang(row.Lang),
		ContentLimit:     actor.ContentLimit(row.ContentLimit),
		Created:          row.Created,
		Updated:          row.Updated,
		LastLoginAt:      row.LastLoginAt,
		TwoFactorEnabled: row.TwoFactorEnabled,
		SponsorExpiresAt: row.SponsorExpiresAt,
		Counts:           counts,
	}
}
