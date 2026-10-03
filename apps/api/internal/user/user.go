package user

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/paging"
)

const (
	reasonPasswordChanged = "user_password_changed"
	reasonEmailChanged    = "user_email_changed"
	reasonBanned          = "user_banned"
	emailChangeCodeTTL    = 30 * time.Minute
)

type Policy struct {
	AllowRegister bool
}

type RegisterInput struct {
	Name           string
	Email          string
	Password       string
	Lang           *Lang
	Code           string
	CodeID         string
	AcceptLanguage string
}

type EmailChange struct {
	Email       string
	CurrentID   string
	CurrentCode string
	NewID       string
	NewCode     string
}

type BanInput struct {
	BannedBy       *int
	Reason         *string
	DurationDays   *int
	Permanent      bool
	DeleteComments bool
}

const (
	MinNameLength     = 2
	MaxNameLength     = 20
	MaxBioLength      = 500
	MinPasswordLength = 8
	MaxPasswordLength = 50
	MaxBanReason      = 255
	MaxBanDays        = 999
	DefaultFavorite   = "default"
)

type Status int

const (
	StatusActive Status = 1
	StatusBanned Status = 2
)

type Lang string

const (
	LangEN Lang = "en"
	LangZH Lang = "zh"
	LangJA Lang = "ja"
)

func (l Lang) Valid() bool {
	return l == LangEN || l == LangZH || l == LangJA
}

type User struct {
	ID                     int
	Name                   string
	Email                  string
	PasswordHash           *string
	Avatar                 *string
	Cover                  *string
	Bio                    *string
	Lang                   Lang
	ContentLimit           actor.ContentLimit
	OnlyGamesWithResources bool
	Role                   actor.Role
	Status                 Status
	EmailVerifiedAt        *time.Time
	TwoFactorEnabled       bool
	SponsorExpiresAt       *time.Time
	Created                time.Time
}

func (u User) Banned() bool {
	return u.Status == StatusBanned
}

func (u User) HasPassword() bool {
	return u.PasswordHash != nil && *u.PasswordHash != ""
}

func (u User) IsSponsor(now time.Time) bool {
	return u.SponsorExpiresAt != nil && u.SponsorExpiresAt.After(now)
}

type NewUser struct {
	Name            string
	Email           string
	PasswordHash    *string
	Lang            Lang
	ContentLimit    actor.ContentLimit
	EmailVerifiedAt *time.Time
}

type Changes struct {
	Name                   *string
	Email                  *string
	PasswordHash           *string
	Avatar                 *string
	Cover                  *string
	Bio                    *string
	Lang                   *Lang
	ContentLimit           *actor.ContentLimit
	OnlyGamesWithResources *bool
	Status                 *Status
	EmailVerifiedAt        *time.Time
	LastLoginAt            *time.Time
	TwoFactorEnabled       *bool
}

type Stats struct {
	Resources     int
	Comments      int
	FavoriteItems int
	Edits         int
	Walkthroughs  int
}

type Profile struct {
	User
	Stats
}

type Ban struct {
	UserID       int
	BannedAt     time.Time
	DurationDays *int
	Permanent    bool
}

func (b Ban) ExpiresAt() (time.Time, bool) {
	if b.Permanent || b.DurationDays == nil || *b.DurationDays <= 0 {
		return time.Time{}, false
	}
	return b.BannedAt.Add(time.Duration(*b.DurationDays) * 24 * time.Hour), true
}

type NewBan struct {
	UserID       int
	BannedBy     *int
	Reason       *string
	DurationDays *int
	Permanent    bool
}

type Page = paging.Page
