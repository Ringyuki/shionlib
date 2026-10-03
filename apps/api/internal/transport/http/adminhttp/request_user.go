package adminhttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/admin"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

type adminUserPathInput struct {
	ID int `path:"id" minimum:"1"`
}

type adminUserListInput struct {
	httpapi.PageQuery
	Search    string `query:"search" doc:"Case-insensitive substring of the name or email, or an exact user id"`
	Role      int    `query:"role" enum:"1,2,3"`
	Status    int    `query:"status" enum:"1,2"`
	SortBy    string `query:"sortBy" default:"id" enum:"id,name,email,role,status,created,updated,last_login_at"`
	SortOrder string `query:"sortOrder" default:"desc" enum:"asc,desc"`
}

func (in *adminUserListInput) filter() admin.UserFilter {
	filter := admin.UserFilter{Search: in.Search, SortBy: admin.UserSortField(in.SortBy), Descending: in.SortOrder != "asc"}
	if in.Role != 0 {
		role := actor.Role(in.Role)
		filter.Role = &role
	}
	if in.Status != 0 {
		status := user.Status(in.Status)
		filter.Status = &status
	}
	return filter
}

type adminUserProfileInput struct {
	ID   int `path:"id" minimum:"1"`
	Body struct {
		Name         *string `json:"name,omitempty" minLength:"2" maxLength:"20"`
		Email        *string `json:"email,omitempty" format:"email" maxLength:"255"`
		Lang         *string `json:"lang,omitempty" enum:"en,zh,ja"`
		ContentLimit *int    `json:"content_limit,omitempty" enum:"1,2,3"`
	}
}

func (in *adminUserProfileInput) changes() admin.ProfileChanges {
	changes := admin.ProfileChanges{Name: in.Body.Name, Email: in.Body.Email}
	if in.Body.Lang != nil {
		lang := user.Lang(*in.Body.Lang)
		changes.Lang = &lang
	}
	if in.Body.ContentLimit != nil {
		limit := actor.ContentLimit(*in.Body.ContentLimit)
		changes.ContentLimit = &limit
	}
	return changes
}

type adminUserRoleInput struct {
	ID   int `path:"id" minimum:"1"`
	Body struct {
		Role int `json:"role" enum:"1,2,3"`
	}
}

type adminUserBanInput struct {
	ID   int `path:"id" minimum:"1"`
	Body struct {
		BannedBy           *int    `json:"banned_by,omitempty" doc:"Ignored; the acting administrator is recorded"`
		BannedReason       *string `json:"banned_reason,omitempty" maxLength:"255"`
		BannedDurationDays *int    `json:"banned_duration_days,omitempty" minimum:"1" maximum:"999" doc:"Required unless is_permanent is true"`
		IsPermanent        *bool   `json:"is_permanent,omitempty"`
		DeleteUserComments *bool   `json:"delete_user_comments,omitempty"`
	}
}

type adminUserPasswordInput struct {
	ID   int `path:"id" minimum:"1"`
	Body struct {
		Password string `json:"password" minLength:"8" maxLength:"50" doc:"Needs an upper-case letter, a lower-case letter and a digit or symbol"`
	}
}

type adminUserSessionsInput struct {
	httpapi.PageQuery
	ID     int `path:"id"`
	Status int `query:"status" minimum:"1" maximum:"4" doc:"1 active, 2 rotated, 3 reused, 4 blocked"`
}

type adminUserPermissionsInput struct {
	ID     int    `path:"id" minimum:"1"`
	Entity string `query:"entity" required:"true" enum:"game,character,developer"`
}

type adminUserSetPermissionsInput struct {
	ID   int `path:"id" minimum:"1"`
	Body struct {
		Entity    string `json:"entity" enum:"game,character,developer"`
		AllowBits []int  `json:"allowBits,omitempty" uniqueItems:"true" doc:"Replaces the user's grants; omitted or empty clears them"`
	}
}

type adminUserQuotaSizeInput struct {
	ID   int `path:"id" minimum:"1"`
	Body struct {
		Action       string  `json:"action" enum:"ADD,SUB"`
		Amount       int64   `json:"amount" minimum:"1" doc:"Bytes"`
		ActionReason *string `json:"action_reason,omitempty" maxLength:"255"`
	}
}

type adminUserQuotaUsedInput struct {
	ID   int `path:"id" minimum:"1"`
	Body struct {
		Action       string  `json:"action" enum:"USE,ADD" doc:"USE consumes quota, ADD gives it back"`
		Amount       int64   `json:"amount" minimum:"1" doc:"Bytes"`
		ActionReason *string `json:"action_reason,omitempty" maxLength:"255"`
	}
}

type adminUserSponsorInput struct {
	ID   int `path:"id" minimum:"1"`
	Body struct {
		SponsorExpiresAt *time.Time `json:"sponsor_expires_at,omitempty" nullable:"true" doc:"Omitted or null clears the badge"`
	}
}
