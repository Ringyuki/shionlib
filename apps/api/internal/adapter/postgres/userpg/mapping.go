package userpg

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entuser "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/user"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

func toEditRecord(row *ent.EditRecord) user.EditRecord {
	fields := []string(row.ChangedFields)
	if fields == nil {
		fields = []string{}
	}
	var relation *string
	if row.RelationType != nil {
		value := string(*row.RelationType)
		relation = &value
	}
	return user.EditRecord{
		ID:           row.ID,
		Entity:       string(row.Entity),
		TargetID:     row.TargetID,
		Action:       string(row.Action),
		FieldChanges: fields,
		Changes:      row.Changes,
		RelationType: relation,
		Created:      row.Created,
		Updated:      row.Updated,
	}
}

func toUser(row *ent.User) user.User {
	return user.User{
		ID:                     row.ID,
		Name:                   row.Name,
		Email:                  row.Email,
		PasswordHash:           row.Password,
		Avatar:                 row.Avatar,
		Cover:                  row.Cover,
		Bio:                    row.Bio,
		Lang:                   user.Lang(row.Lang),
		ContentLimit:           actor.ContentLimit(row.ContentLimit),
		OnlyGamesWithResources: row.OnlyGamesWithResources,
		Role:                   actor.Role(row.Role),
		Status:                 user.Status(row.Status),
		EmailVerifiedAt:        row.EmailVerifiedAt,
		TwoFactorEnabled:       row.TwoFactorEnabled,
		SponsorExpiresAt:       row.SponsorExpiresAt,
		Created:                row.Created,
	}
}

var SummaryFields = []string{entuser.FieldID, entuser.FieldName, entuser.FieldAvatar, entuser.FieldSponsorExpiresAt}

func SelectSummary(q *ent.UserQuery) {
	q.Select(SummaryFields...)
}

func ToSummary(row *ent.User) user.Summary {
	if row == nil {
		return user.Summary{}
	}
	return user.Summary{ID: row.ID, Name: row.Name, Avatar: row.Avatar, SponsorExpiresAt: row.SponsorExpiresAt}
}

func ToSummaryPtr(row *ent.User) *user.Summary {
	if row == nil {
		return nil
	}
	summary := ToSummary(row)
	return &summary
}
