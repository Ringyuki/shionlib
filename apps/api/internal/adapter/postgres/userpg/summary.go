package userpg

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entuser "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/user"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

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
