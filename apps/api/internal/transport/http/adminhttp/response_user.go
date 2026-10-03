package adminhttp

import (
	"strconv"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/admin"
)

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
