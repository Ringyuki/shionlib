package admintest

import (
	"context"
	"encoding/json"
	"maps"
	"slices"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/admin"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

type UserStore struct {
	mu       sync.Mutex
	entries  []admin.UserEntry
	details  map[int]admin.UserDetail
	sessions []admin.Session
	roles    map[int]actor.Role
	sponsors map[int]*time.Time
	filter   admin.UserFilter
	page     admin.Page
}

func NewUserStore() *UserStore {
	return &UserStore{details: map[int]admin.UserDetail{}, roles: map[int]actor.Role{}, sponsors: map[int]*time.Time{}}
}

func (s *UserStore) AddEntry(entry admin.UserEntry) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.entries = append(s.entries, entry)
}

func (s *UserStore) AddDetail(detail admin.UserDetail) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.details[detail.ID] = detail
}

func (s *UserStore) AddSession(session admin.Session) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessions = append(s.sessions, session)
}

func (s *UserStore) LastQuery() (admin.UserFilter, admin.Page) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.filter, s.page
}

func (s *UserStore) Role(id int) (actor.Role, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	role, ok := s.roles[id]
	return role, ok
}

func (s *UserStore) Sponsor(id int) (*time.Time, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	at, ok := s.sponsors[id]
	return at, ok
}

func (s *UserStore) SearchUsers(_ context.Context, filter admin.UserFilter, page admin.Page) ([]admin.UserEntry, int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.filter, s.page = filter, page
	start := min(page.Offset(), len(s.entries))
	end := min(start+page.Size, len(s.entries))
	return slices.Clone(s.entries[start:end]), len(s.entries), nil
}

func (s *UserStore) UserDetail(_ context.Context, id int) (admin.UserDetail, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	detail, ok := s.details[id]
	if !ok {
		return admin.UserDetail{}, user.ErrNotFound
	}
	return detail, nil
}

func (s *UserStore) SetRole(_ context.Context, id int, role actor.Role) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.roles[id] = role
	return nil
}

func (s *UserStore) SetSponsorExpiry(_ context.Context, id int, expiresAt *time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sponsors[id] = expiresAt
	return nil
}

func (s *UserStore) Sessions(_ context.Context, filter admin.SessionFilter, page admin.Page) ([]admin.Session, int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var matched []admin.Session
	for _, session := range s.sessions {
		if filter.Status != nil && session.Status != *filter.Status {
			continue
		}
		matched = append(matched, session)
	}
	start := min(page.Offset(), len(matched))
	end := min(start+page.Size, len(matched))
	return slices.Clone(matched[start:end]), len(matched), nil
}

type PermissionStore struct {
	mu        sync.Mutex
	roleMasks map[actor.Role]map[admin.PermissionEntity]int64
	userMasks map[int]map[admin.PermissionEntity]int64
	mappings  map[admin.PermissionEntity][]admin.PermissionMapping
}

func NewPermissionStore() *PermissionStore {
	return &PermissionStore{
		roleMasks: map[actor.Role]map[admin.PermissionEntity]int64{},
		userMasks: map[int]map[admin.PermissionEntity]int64{},
		mappings:  map[admin.PermissionEntity][]admin.PermissionMapping{},
	}
}

func (s *PermissionStore) SetRoleMask(role actor.Role, entity admin.PermissionEntity, mask int64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.roleMasks[role] == nil {
		s.roleMasks[role] = map[admin.PermissionEntity]int64{}
	}
	s.roleMasks[role][entity] = mask
}

func (s *PermissionStore) SetMappings(entity admin.PermissionEntity, mappings ...admin.PermissionMapping) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.mappings[entity] = slices.Clone(mappings)
}

func (s *PermissionStore) StoredUserMask(userID int, entity admin.PermissionEntity) (int64, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	mask, ok := s.userMasks[userID][entity]
	return mask, ok
}

func (s *PermissionStore) RoleMask(_ context.Context, role actor.Role, entity admin.PermissionEntity) (int64, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.roleMasks[role][entity], nil
}

func (s *PermissionStore) UserMask(_ context.Context, userID int, entity admin.PermissionEntity) (int64, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.userMasks[userID][entity], nil
}

func (s *PermissionStore) PermissionMappings(_ context.Context, entity admin.PermissionEntity) ([]admin.PermissionMapping, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	mappings := slices.Clone(s.mappings[entity])
	slices.SortFunc(mappings, func(a, b admin.PermissionMapping) int { return a.BitIndex - b.BitIndex })
	return mappings, nil
}

func (s *PermissionStore) SetUserMask(_ context.Context, userID int, entity admin.PermissionEntity, mask int64) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.userMasks[userID] == nil {
		s.userMasks[userID] = map[admin.PermissionEntity]int64{}
	}
	s.userMasks[userID][entity] = mask
	return nil
}

type Sessions struct {
	mu      sync.Mutex
	revoked map[int]string
}

func NewSessions() *Sessions {
	return &Sessions{revoked: map[int]string{}}
}

func (s *Sessions) RevokeUser(_ context.Context, userID int, reason string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.revoked[userID] = reason
	return nil
}

func (s *Sessions) Revoked(userID int) (string, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	reason, ok := s.revoked[userID]
	return reason, ok
}

type Hasher struct{}

func (Hasher) Hash(secret string) (string, error) {
	return "hash:" + secret, nil
}

func (Hasher) Verify(hash, secret string) (bool, error) {
	return hash == "hash:"+secret, nil
}

type StatsStore struct {
	mu        sync.Mutex
	overview  admin.Overview
	daily     admin.DailyCounts
	since     []time.Time
	offset    time.Duration
	overviews int
}

func NewStatsStore(overview admin.Overview, daily admin.DailyCounts) *StatsStore {
	return &StatsStore{overview: overview, daily: daily}
}

func (s *StatsStore) Overview(_ context.Context, since time.Time) (admin.Overview, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.overviews++
	s.since = append(s.since, since)
	return s.overview, nil
}

func (s *StatsStore) DailyCreations(_ context.Context, since time.Time, offset time.Duration) (admin.DailyCounts, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.since = append(s.since, since)
	s.offset = offset
	return admin.DailyCounts{Games: maps.Clone(s.daily.Games), Users: maps.Clone(s.daily.Users)}, nil
}

func (s *StatsStore) Calls() ([]time.Time, time.Duration) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return slices.Clone(s.since), s.offset
}

type Cache struct {
	mu      sync.Mutex
	entries map[string][]byte
	ttls    map[string]time.Duration
}

func NewCache() *Cache {
	return &Cache{entries: map[string][]byte{}, ttls: map[string]time.Duration{}}
}

func (c *Cache) Get(_ context.Context, key string, dst any) (bool, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	raw, ok := c.entries[key]
	if !ok {
		return false, nil
	}
	return true, json.Unmarshal(raw, dst)
}

func (c *Cache) Set(_ context.Context, key string, value any, ttl time.Duration) error {
	raw, err := json.Marshal(value)
	if err != nil {
		return err
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries[key] = raw
	c.ttls[key] = ttl
	return nil
}

func (c *Cache) TTL(key string) (time.Duration, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	ttl, ok := c.ttls[key]
	return ttl, ok
}
