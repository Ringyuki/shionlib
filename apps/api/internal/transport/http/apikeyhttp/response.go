package apikeyhttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/apikey"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/userhttp"
)

type apiKeyDTO struct {
	ID              int        `json:"id"`
	Name            string     `json:"name"`
	Prefix          string     `json:"prefix" doc:"The first characters of the key, to tell it apart"`
	Status          string     `json:"status" enum:"active,suspended"`
	SuspendedReason *string    `json:"suspended_reason"`
	SuspendedAt     *time.Time `json:"suspended_at"`
	LastUsedAt      *time.Time `json:"last_used_at" doc:"Written at most once every five minutes"`
	Created         time.Time  `json:"created"`
}

type myKeysDTO struct {
	Keys    []apiKeyDTO `json:"keys"`
	Limit   int         `json:"limit" doc:"How many keys an account may have"`
	Enabled bool        `json:"enabled" doc:"Whether the open API answers requests"`
}

type issuedKeyDTO struct {
	Key    apiKeyDTO `json:"key"`
	Secret string    `json:"secret" doc:"The whole key; it is shown only this once"`
}

type usageDTO struct {
	Requests  int `json:"requests"`
	Throttled int `json:"throttled"`
}

type dayDTO struct {
	Day       string `json:"day" format:"date"`
	Requests  int    `json:"requests"`
	Throttled int    `json:"throttled"`
}

type openSummaryDTO struct {
	Today     int  `json:"today" doc:"Requests today, counted up to ten minutes ago"`
	Throttled int  `json:"throttled" doc:"Requests refused for their rate in the last 7 days"`
	Used      int  `json:"used" doc:"Keys used in the last 7 days"`
	Total     int  `json:"total"`
	Enabled   bool `json:"enabled"`
}

type adminKeyDTO struct {
	ID              int                     `json:"id"`
	Name            string                  `json:"name"`
	Prefix          string                  `json:"prefix"`
	Status          string                  `json:"status" enum:"active,suspended"`
	SuspendedReason *string                 `json:"suspended_reason"`
	SuspendedAt     *time.Time              `json:"suspended_at"`
	LastUsedAt      *time.Time              `json:"last_used_at"`
	LastUsedIP      *string                 `json:"last_used_ip"`
	Created         time.Time               `json:"created"`
	Owner           userhttp.UserSummaryDTO `json:"owner"`
	Recent          usageDTO                `json:"recent" doc:"Requests in the last 7 days"`
}

type adminKeyDetailDTO struct {
	Key          adminKeyDTO `json:"key"`
	Days         []dayDTO    `json:"days" doc:"The last 30 days, oldest first"`
	Total        usageDTO    `json:"total" doc:"Requests in the last 30 days"`
	AccountLimit *int        `json:"account_limit" doc:"The account's own limit; null when it follows the site's"`
	Others       []apiKeyDTO `json:"others" doc:"The other keys of the account"`
}

func statusOf(key apikey.Key) string {
	if key.Suspended() {
		return "suspended"
	}
	return "active"
}

func toKeyDTO(key apikey.Key) apiKeyDTO {
	return apiKeyDTO{
		ID:              key.ID,
		Name:            key.Name,
		Prefix:          key.Prefix,
		Status:          statusOf(key),
		SuspendedReason: key.SuspendedReason,
		SuspendedAt:     key.SuspendedAt,
		LastUsedAt:      key.LastUsedAt,
		Created:         key.Created,
	}
}

func toKeyDTOs(keys []apikey.Key) []apiKeyDTO {
	out := make([]apiKeyDTO, len(keys))
	for i, key := range keys {
		out[i] = toKeyDTO(key)
	}
	return out
}

func toAdminKeyDTO(listed apikey.Listed, now time.Time) adminKeyDTO {
	key := listed.Key
	return adminKeyDTO{
		ID:              key.ID,
		Name:            key.Name,
		Prefix:          key.Prefix,
		Status:          statusOf(key),
		SuspendedReason: key.SuspendedReason,
		SuspendedAt:     key.SuspendedAt,
		LastUsedAt:      key.LastUsedAt,
		LastUsedIP:      key.LastUsedIP,
		Created:         key.Created,
		Owner:           userhttp.ToUserSummary(listed.Owner, now),
		Recent:          usageDTO(listed.Recent),
	}
}

func toDayDTOs(days []apikey.Day) []dayDTO {
	out := make([]dayDTO, len(days))
	for i, day := range days {
		out[i] = dayDTO{Day: day.Day.Format(time.DateOnly), Requests: day.Requests, Throttled: day.Throttled}
	}
	return out
}
