package adminhttp

import (
	"strconv"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/admin"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

type adminUserPath struct {
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

type adminUserCountsDTO struct {
	Comments  int `json:"comments"`
	Resources int `json:"resources"`
	Favorites int `json:"favorites"`
	Edits     int `json:"edits"`
}

type adminUserItemDTO struct {
	ID               int                `json:"id"`
	Name             string             `json:"name"`
	Email            string             `json:"email"`
	Avatar           *string            `json:"avatar"`
	Role             int                `json:"role"`
	Status           int                `json:"status"`
	Lang             string             `json:"lang"`
	ContentLimit     int                `json:"content_limit"`
	Created          time.Time          `json:"created"`
	Updated          time.Time          `json:"updated"`
	LastLoginAt      *time.Time         `json:"last_login_at"`
	TwoFactorEnabled bool               `json:"two_factor_enabled"`
	SponsorExpiresAt *time.Time         `json:"sponsor_expires_at"`
	Counts           adminUserCountsDTO `json:"counts"`
}

func toAdminUserItem(entry admin.UserEntry) adminUserItemDTO {
	return adminUserItemDTO{
		ID:               entry.ID,
		Name:             entry.Name,
		Email:            entry.Email,
		Avatar:           entry.Avatar,
		Role:             int(entry.Role),
		Status:           int(entry.Status),
		Lang:             string(entry.Lang),
		ContentLimit:     int(entry.ContentLimit),
		Created:          entry.Created,
		Updated:          entry.Updated,
		LastLoginAt:      entry.LastLoginAt,
		TwoFactorEnabled: entry.TwoFactorEnabled,
		SponsorExpiresAt: entry.SponsorExpiresAt,
		Counts:           adminUserCountsDTO(entry.Counts),
	}
}

type adminUserQuotaDTO struct {
	Size         string `json:"size" doc:"Bytes as a decimal string"`
	Used         string `json:"used" doc:"Bytes as a decimal string"`
	IsFirstGrant bool   `json:"is_first_grant"`
}

type adminUserRefDTO struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type adminUserBanDTO struct {
	BannedAt           time.Time        `json:"banned_at"`
	BannedReason       *string          `json:"banned_reason"`
	BannedDurationDays *int             `json:"banned_duration_days"`
	IsPermanent        bool             `json:"is_permanent"`
	UnbannedAt         *time.Time       `json:"unbanned_at"`
	BannedBy           *adminUserRefDTO `json:"banned_by"`
}

type adminUserDetailDTO struct {
	ID               int                `json:"id"`
	Name             string             `json:"name"`
	Email            string             `json:"email"`
	Avatar           *string            `json:"avatar"`
	Cover            *string            `json:"cover"`
	Role             int                `json:"role"`
	Status           int                `json:"status"`
	Lang             string             `json:"lang"`
	ContentLimit     int                `json:"content_limit"`
	Created          time.Time          `json:"created"`
	Updated          time.Time          `json:"updated"`
	LastLoginAt      *time.Time         `json:"last_login_at"`
	TwoFactorEnabled bool               `json:"two_factor_enabled"`
	SponsorExpiresAt *time.Time         `json:"sponsor_expires_at"`
	UploadQuota      *adminUserQuotaDTO `json:"upload_quota,omitempty" doc:"Absent when the user has no quota row"`
	Counts           adminUserCountsDTO `json:"counts"`
	LatestBan        *adminUserBanDTO   `json:"latest_ban"`
}

func toAdminUserDetail(detail admin.UserDetail) adminUserDetailDTO {
	item := toAdminUserItem(detail.UserEntry)
	out := adminUserDetailDTO{
		ID:               item.ID,
		Name:             item.Name,
		Email:            item.Email,
		Avatar:           item.Avatar,
		Cover:            detail.Cover,
		Role:             item.Role,
		Status:           item.Status,
		Lang:             item.Lang,
		ContentLimit:     item.ContentLimit,
		Created:          item.Created,
		Updated:          item.Updated,
		LastLoginAt:      item.LastLoginAt,
		TwoFactorEnabled: item.TwoFactorEnabled,
		SponsorExpiresAt: item.SponsorExpiresAt,
		Counts:           item.Counts,
	}
	if quota := detail.Quota; quota != nil {
		out.UploadQuota = &adminUserQuotaDTO{Size: strconv.FormatInt(quota.Size, 10), Used: strconv.FormatInt(quota.Used, 10), IsFirstGrant: quota.IsFirstGrant}
	}
	if ban := detail.LatestBan; ban != nil {
		out.LatestBan = &adminUserBanDTO{
			BannedAt:           ban.BannedAt,
			BannedReason:       ban.Reason,
			BannedDurationDays: ban.DurationDays,
			IsPermanent:        ban.Permanent,
			UnbannedAt:         ban.UnbannedAt,
		}
		if ban.BannedBy != nil {
			out.LatestBan.BannedBy = &adminUserRefDTO{ID: ban.BannedBy.ID, Name: ban.BannedBy.Name}
		}
	}
	return out
}

type adminUserProfileDTO struct {
	ID           int     `json:"id"`
	Name         string  `json:"name"`
	Email        string  `json:"email"`
	Lang         *string `json:"lang,omitempty" doc:"Present when something changed"`
	ContentLimit *int    `json:"content_limit,omitempty" doc:"Present when something changed"`
}

type adminUserSessionDTO struct {
	ID            int        `json:"id"`
	FamilyID      string     `json:"family_id"`
	Status        int        `json:"status"`
	IP            *string    `json:"ip"`
	UserAgent     *string    `json:"user_agent"`
	DeviceInfo    *string    `json:"device_info"`
	Created       time.Time  `json:"created"`
	Updated       time.Time  `json:"updated"`
	LastUsedAt    *time.Time `json:"last_used_at"`
	ExpiresAt     time.Time  `json:"expires_at"`
	RotatedAt     *time.Time `json:"rotated_at"`
	ReusedAt      *time.Time `json:"reused_at"`
	BlockedAt     *time.Time `json:"blocked_at"`
	BlockedReason *string    `json:"blocked_reason"`
}

func toAdminUserSession(s admin.Session) adminUserSessionDTO {
	return adminUserSessionDTO{
		ID:            s.ID,
		FamilyID:      s.FamilyID,
		Status:        int(s.Status),
		IP:            s.IP,
		UserAgent:     s.UserAgent,
		DeviceInfo:    s.DeviceInfo,
		Created:       s.Created,
		Updated:       s.Updated,
		LastUsedAt:    s.LastUsedAt,
		ExpiresAt:     s.ExpiresAt,
		RotatedAt:     s.RotatedAt,
		ReusedAt:      s.ReusedAt,
		BlockedAt:     s.BlockedAt,
		BlockedReason: s.BlockedReason,
	}
}

type adminUserPermissionGroupDTO struct {
	Field      string   `json:"field"`
	BitIndex   int      `json:"bitIndex"`
	IsRelation bool     `json:"isRelation"`
	Fields     []string `json:"fields"`
	Enabled    bool     `json:"enabled"`
	Source     string   `json:"source" enum:"role,user,none"`
	Mutable    bool     `json:"mutable"`
}

type adminUserPermissionsDTO struct {
	Entity    string                        `json:"entity"`
	RoleMask  string                        `json:"roleMask" doc:"Decimal string"`
	UserMask  string                        `json:"userMask" doc:"Decimal string"`
	AllowMask string                        `json:"allowMask" doc:"Decimal string"`
	Groups    []adminUserPermissionGroupDTO `json:"groups"`
}

func toAdminUserPermissions(view admin.Permissions) adminUserPermissionsDTO {
	groups := make([]adminUserPermissionGroupDTO, len(view.Groups))
	for i, group := range view.Groups {
		groups[i] = adminUserPermissionGroupDTO{
			Field:      group.Field,
			BitIndex:   group.BitIndex,
			IsRelation: group.IsRelation,
			Fields:     group.Fields,
			Enabled:    group.Enabled,
			Source:     string(group.Source),
			Mutable:    group.Mutable,
		}
	}
	return adminUserPermissionsDTO{
		Entity:    string(view.Entity),
		RoleMask:  strconv.FormatInt(view.RoleMask, 10),
		UserMask:  strconv.FormatInt(view.UserMask, 10),
		AllowMask: strconv.FormatInt(view.AllowMask, 10),
		Groups:    groups,
	}
}

type adminUserAllowMaskDTO struct {
	AllowMask string `json:"allowMask" doc:"Decimal string of the user's own grants"`
}
