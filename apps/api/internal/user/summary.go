package user

import "time"

type Summary struct {
	ID               int
	Name             string
	Avatar           *string
	SponsorExpiresAt *time.Time
}

func (s Summary) IsSponsor(now time.Time) bool {
	return s.SponsorExpiresAt != nil && s.SponsorExpiresAt.After(now)
}
