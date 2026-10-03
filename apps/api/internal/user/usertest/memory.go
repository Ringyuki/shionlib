package usertest

import (
	"cmp"
	"context"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

type banRecord struct {
	id         int
	ban        user.NewBan
	bannedAt   time.Time
	unbannedAt *time.Time
}

type MemoryRepository struct {
	mu               sync.Mutex
	now              func() time.Time
	nextID           int
	nextBan          int
	users            map[int]user.User
	lastLogin        map[int]time.Time
	stats            map[int]user.Stats
	bans             []banRecord
	defaultFavorites map[int]bool
	quotas           map[int]bool
	deletedComments  map[int]bool
}

func NewMemoryRepository(now func() time.Time) *MemoryRepository {
	return &MemoryRepository{
		now:              now,
		users:            map[int]user.User{},
		lastLogin:        map[int]time.Time{},
		stats:            map[int]user.Stats{},
		defaultFavorites: map[int]bool{},
		quotas:           map[int]bool{},
		deletedComments:  map[int]bool{},
	}
}

func (r *MemoryRepository) Seed(u user.User) user.User {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.nextID++
	u.ID = r.nextID
	if u.Name == "" {
		u.Name = "user" + strconv.Itoa(u.ID)
	}
	if u.Email == "" {
		u.Email = u.Name + "@example.test"
	}
	if u.Role == 0 {
		u.Role = actor.RoleUser
	}
	if u.Status == 0 {
		u.Status = user.StatusActive
	}
	if u.Lang == "" {
		u.Lang = user.LangEN
	}
	if u.ContentLimit == 0 {
		u.ContentLimit = actor.ContentLimitNeverShow
	}
	u.Created = r.now()
	r.users[u.ID] = u
	return u
}

func (r *MemoryRepository) SetStats(id int, stats user.Stats) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.stats[id] = stats
}

func (r *MemoryRepository) SeedBan(userID int, bannedAt time.Time, days *int, permanent bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.nextBan++
	r.bans = append(r.bans, banRecord{id: r.nextBan, ban: user.NewBan{UserID: userID, DurationDays: days, Permanent: permanent}, bannedAt: bannedAt})
}

func (r *MemoryRepository) User(id int) user.User {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.users[id]
}

func (r *MemoryRepository) LastLogin(id int) (time.Time, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	at, ok := r.lastLogin[id]
	return at, ok
}

func (r *MemoryRepository) HasDefaultFavorite(id int) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.defaultFavorites[id]
}

func (r *MemoryRepository) HasQuota(id int) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.quotas[id]
}

func (r *MemoryRepository) CommentsDeleted(id int) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.deletedComments[id]
}

func (r *MemoryRepository) OpenBans(userID int) int {
	r.mu.Lock()
	defer r.mu.Unlock()
	open := 0
	for _, record := range r.bans {
		if record.ban.UserID == userID && record.unbannedAt == nil {
			open++
		}
	}
	return open
}

func (r *MemoryRepository) Get(_ context.Context, id int) (user.User, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	found, ok := r.users[id]
	if !ok {
		return user.User{}, user.ErrNotFound
	}
	return found, nil
}

func (r *MemoryRepository) Lock(ctx context.Context, id int) (user.User, error) {
	return r.Get(ctx, id)
}

func (r *MemoryRepository) FindByEmail(_ context.Context, email string) (user.User, bool, error) {
	return r.first(func(u user.User) bool { return u.Email == email })
}

func (r *MemoryRepository) FindByEmailFold(_ context.Context, email string) (user.User, bool, error) {
	return r.first(func(u user.User) bool { return strings.EqualFold(u.Email, email) })
}

func (r *MemoryRepository) FindByIdentifier(_ context.Context, identifier string) (user.User, bool, error) {
	return r.first(func(u user.User) bool {
		return strings.EqualFold(u.Email, identifier) || strings.EqualFold(u.Name, identifier)
	})
}

func (r *MemoryRepository) NameExists(_ context.Context, name string) (bool, error) {
	_, found, err := r.first(func(u user.User) bool { return u.Name == name })
	return found, err
}

func (r *MemoryRepository) first(match func(user.User) bool) (user.User, bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	ids := make([]int, 0, len(r.users))
	for id := range r.users {
		ids = append(ids, id)
	}
	slices.Sort(ids)
	for _, id := range ids {
		if match(r.users[id]) {
			return r.users[id], true, nil
		}
	}
	return user.User{}, false, nil
}

func (r *MemoryRepository) Create(_ context.Context, in user.NewUser) (user.User, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, existing := range r.users {
		if existing.Email == in.Email {
			return user.User{}, user.ErrEmailAlreadyExists
		}
		if existing.Name == in.Name {
			return user.User{}, user.ErrNameAlreadyExists
		}
	}
	r.nextID++
	created := user.User{
		ID:                     r.nextID,
		Name:                   in.Name,
		Email:                  in.Email,
		PasswordHash:           in.PasswordHash,
		Lang:                   in.Lang,
		ContentLimit:           in.ContentLimit,
		OnlyGamesWithResources: true,
		Role:                   actor.RoleUser,
		Status:                 user.StatusActive,
		EmailVerifiedAt:        in.EmailVerifiedAt,
		Created:                r.now(),
	}
	r.users[created.ID] = created
	r.defaultFavorites[created.ID] = true
	r.quotas[created.ID] = true
	return created, nil
}

func (r *MemoryRepository) Update(_ context.Context, id int, changes user.Changes) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	current, ok := r.users[id]
	if !ok {
		return user.ErrNotFound
	}
	for otherID, other := range r.users {
		if otherID == id {
			continue
		}
		if changes.Email != nil && other.Email == *changes.Email {
			return user.ErrEmailAlreadyExists
		}
		if changes.Name != nil && other.Name == *changes.Name {
			return user.ErrNameAlreadyExists
		}
	}
	apply(&current, changes)
	if changes.LastLoginAt != nil {
		r.lastLogin[id] = *changes.LastLoginAt
	}
	r.users[id] = current
	return nil
}

func apply(u *user.User, c user.Changes) {
	set(&u.Name, c.Name)
	set(&u.Email, c.Email)
	setPtr(&u.PasswordHash, c.PasswordHash)
	setPtr(&u.Avatar, c.Avatar)
	setPtr(&u.Cover, c.Cover)
	setPtr(&u.Bio, c.Bio)
	set(&u.Lang, c.Lang)
	set(&u.ContentLimit, c.ContentLimit)
	set(&u.OnlyGamesWithResources, c.OnlyGamesWithResources)
	set(&u.Status, c.Status)
	setPtr(&u.EmailVerifiedAt, c.EmailVerifiedAt)
	set(&u.TwoFactorEnabled, c.TwoFactorEnabled)
}

func set[T any](dst *T, value *T) {
	if value != nil {
		*dst = *value
	}
}

func setPtr[T any](dst **T, value *T) {
	if value != nil {
		copied := *value
		*dst = &copied
	}
}

func (r *MemoryRepository) Stats(_ context.Context, id int) (user.Stats, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.stats[id], nil
}

func (r *MemoryRepository) CreateBan(_ context.Context, in user.NewBan) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.users[in.UserID]; !ok {
		return user.ErrNotFound
	}
	r.nextBan++
	r.bans = append(r.bans, banRecord{id: r.nextBan, ban: in, bannedAt: r.now()})
	return nil
}

func (r *MemoryRepository) CloseLatestBan(_ context.Context, userID int, at time.Time) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	latest := -1
	for i, record := range r.bans {
		if record.ban.UserID != userID || record.unbannedAt != nil {
			continue
		}
		if latest < 0 || record.bannedAt.After(r.bans[latest].bannedAt) || (record.bannedAt.Equal(r.bans[latest].bannedAt) && record.id > r.bans[latest].id) {
			latest = i
		}
	}
	if latest >= 0 {
		r.bans[latest].unbannedAt = &at
	}
	return nil
}

func (r *MemoryRepository) ActiveBans(_ context.Context) ([]user.Ban, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	latest := map[int]banRecord{}
	for _, record := range r.bans {
		if record.unbannedAt != nil || r.users[record.ban.UserID].Status != user.StatusBanned {
			continue
		}
		current, ok := latest[record.ban.UserID]
		if !ok || record.bannedAt.After(current.bannedAt) || (record.bannedAt.Equal(current.bannedAt) && record.id > current.id) {
			latest[record.ban.UserID] = record
		}
	}
	bans := make([]user.Ban, 0, len(latest))
	for userID, record := range latest {
		bans = append(bans, user.Ban{UserID: userID, BannedAt: record.bannedAt, DurationDays: record.ban.DurationDays, Permanent: record.ban.Permanent})
	}
	slices.SortFunc(bans, func(a, b user.Ban) int { return cmp.Compare(a.UserID, b.UserID) })
	return bans, nil
}

func (r *MemoryRepository) DeleteComments(_ context.Context, userID int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.deletedComments[userID] = true
	return nil
}
