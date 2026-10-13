package actor

import "context"

type Role int

const (
	RoleUser       Role = 1
	RoleAdmin      Role = 2
	RoleSuperAdmin Role = 3
)

type ContentLimit int

const (
	ContentLimitGuest       ContentLimit = 0
	ContentLimitNeverShow   ContentLimit = 1
	ContentLimitShowSpoiler ContentLimit = 2
	ContentLimitJustShow    ContentLimit = 3
)

type Actor struct {
	UserID       int
	SessionID    int
	FamilyID     string
	Role         Role
	ContentLimit ContentLimit
}

func Guest() Actor {
	return Actor{Role: RoleUser, ContentLimit: ContentLimitGuest}
}

func (a Actor) Authenticated() bool {
	return a.UserID > 0
}

func (a Actor) IncludesRated() bool {
	return a.ContentLimit.IncludesRated()
}

func (a Actor) AtLeast(role Role) bool {
	return a.Authenticated() && a.Role >= role
}

func (c ContentLimit) IncludesRated() bool {
	return c == ContentLimitShowSpoiler || c == ContentLimitJustShow
}

func (c ContentLimit) Valid() bool {
	return c == ContentLimitNeverShow || c == ContentLimitShowSpoiler || c == ContentLimitJustShow
}

type contextKey struct{}

func With(ctx context.Context, a Actor) context.Context {
	return context.WithValue(ctx, contextKey{}, a)
}

func From(ctx context.Context) Actor {
	if a, ok := ctx.Value(contextKey{}).(Actor); ok {
		return a
	}
	return Guest()
}
