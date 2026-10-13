package potatovntest

import (
	"context"
	"slices"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/potatovn"
)

type mappingKey struct {
	userID int
	gameID int
}

type MemoryRepository struct {
	mu       sync.Mutex
	now      func() time.Time
	bindings map[int]potatovn.Binding
	mappings map[mappingKey]potatovn.Mapping
	games    map[int]potatovn.GameInfo
}

func NewMemoryRepository(now func() time.Time) *MemoryRepository {
	return &MemoryRepository{
		now:      now,
		bindings: map[int]potatovn.Binding{},
		mappings: map[mappingKey]potatovn.Mapping{},
		games:    map[int]potatovn.GameInfo{},
	}
}

func (r *MemoryRepository) AddGame(info potatovn.GameInfo) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.games[info.ID] = info
}

func (r *MemoryRepository) Binding(_ context.Context, userID int) (potatovn.Binding, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	binding, ok := r.bindings[userID]
	if !ok {
		return potatovn.Binding{}, potatovn.ErrBindingNotFound
	}
	return binding, nil
}

func (r *MemoryRepository) CreateBinding(_ context.Context, in potatovn.NewBinding) (potatovn.Binding, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.bindings[in.UserID]; ok {
		return potatovn.Binding{}, potatovn.ErrBindingAlreadyExists
	}
	now := r.now()
	binding := potatovn.Binding{UserID: in.UserID, PVNUserID: in.PVNUserID, PVNUserName: in.PVNUserName, Token: in.Token, TokenExpires: in.TokenExpires, Created: now, Updated: now}
	r.bindings[in.UserID] = binding
	return binding, nil
}

func (r *MemoryRepository) DeleteBinding(_ context.Context, userID int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.bindings[userID]; !ok {
		return potatovn.ErrBindingNotFound
	}
	delete(r.bindings, userID)
	return nil
}

func (r *MemoryRepository) UpdateToken(_ context.Context, userID int, token string, expires time.Time) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	binding, ok := r.bindings[userID]
	if !ok {
		return potatovn.ErrBindingNotFound
	}
	binding.Token, binding.TokenExpires, binding.Updated = token, expires, r.now()
	r.bindings[userID] = binding
	return nil
}

func (r *MemoryRepository) BindingsExpiringBefore(_ context.Context, at time.Time) ([]int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	ids := []int{}
	for userID, binding := range r.bindings {
		if !binding.TokenExpires.After(at) {
			ids = append(ids, userID)
		}
	}
	slices.Sort(ids)
	return ids, nil
}

func (r *MemoryRepository) BindingUserIDs(_ context.Context, afterUserID, limit int) ([]int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	ids := []int{}
	for userID := range r.bindings {
		if userID > afterUserID {
			ids = append(ids, userID)
		}
	}
	slices.Sort(ids)
	return ids[:min(limit, len(ids))], nil
}

func (r *MemoryRepository) DeleteExpiredBindings(_ context.Context, now time.Time) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	count := 0
	for userID, binding := range r.bindings {
		if binding.TokenExpires.Before(now) {
			delete(r.bindings, userID)
			for key := range r.mappings {
				if key.userID == userID {
					delete(r.mappings, key)
				}
			}
			count++
		}
	}
	return count, nil
}

func (r *MemoryRepository) Mapping(_ context.Context, userID, gameID int) (potatovn.Mapping, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	mapping, ok := r.mappings[mappingKey{userID, gameID}]
	if !ok {
		return potatovn.Mapping{}, potatovn.ErrMappingNotFound
	}
	return mapping, nil
}

func (r *MemoryRepository) CreateMapping(_ context.Context, in potatovn.NewMapping) (potatovn.Mapping, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.games[in.GameID]; !ok {
		return potatovn.Mapping{}, game.ErrNotFound
	}
	if r.conflicts(in, false) {
		return potatovn.Mapping{}, potatovn.ErrMappingConflict
	}
	mapping := potatovn.Mapping(in)
	r.mappings[mappingKey{in.UserID, in.GameID}] = mapping
	return mapping, nil
}

func (r *MemoryRepository) SyncMapping(_ context.Context, in potatovn.NewMapping) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for key, existing := range r.mappings {
		if key.userID == in.UserID && existing.PVNGalgameID == in.PVNGalgameID {
			existing.PlayData = in.PlayData
			existing.SyncedAt = in.SyncedAt
			r.mappings[key] = existing
			return nil
		}
	}
	if r.conflicts(in, true) {
		return potatovn.ErrMappingConflict
	}
	r.mappings[mappingKey{in.UserID, in.GameID}] = potatovn.Mapping(in)
	return nil
}

func (r *MemoryRepository) conflicts(in potatovn.NewMapping, gameOnly bool) bool {
	for key, existing := range r.mappings {
		if key.userID != in.UserID {
			continue
		}
		if key.gameID == in.GameID || (!gameOnly && existing.PVNGalgameID == in.PVNGalgameID) {
			return true
		}
	}
	return false
}

func (r *MemoryRepository) DeleteMapping(_ context.Context, userID, gameID int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.mappings[mappingKey{userID, gameID}]; !ok {
		return potatovn.ErrMappingNotFound
	}
	delete(r.mappings, mappingKey{userID, gameID})
	return nil
}

func (r *MemoryRepository) DeleteMappings(_ context.Context, userID int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for key := range r.mappings {
		if key.userID == userID {
			delete(r.mappings, key)
		}
	}
	return nil
}

func (r *MemoryRepository) GameInfo(_ context.Context, gameID int) (potatovn.GameInfo, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	info, ok := r.games[gameID]
	if !ok {
		return potatovn.GameInfo{}, game.ErrNotFound
	}
	return info, nil
}

func (r *MemoryRepository) MatchGame(_ context.Context, bangumiID, vndbID *string) (int, bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	best := 0
	for id, info := range r.games {
		matches := (bangumiID != nil && info.BangumiID != nil && *info.BangumiID == *bangumiID) ||
			(vndbID != nil && info.VNDBID != nil && *info.VNDBID == *vndbID)
		if matches && (best == 0 || id < best) {
			best = id
		}
	}
	return best, best != 0, nil
}

func (r *MemoryRepository) Mappings(userID int) []potatovn.Mapping {
	r.mu.Lock()
	defer r.mu.Unlock()
	var out []potatovn.Mapping
	for key, mapping := range r.mappings {
		if key.userID == userID {
			out = append(out, mapping)
		}
	}
	slices.SortFunc(out, func(a, b potatovn.Mapping) int { return a.GameID - b.GameID })
	return out
}

func InfoFrom(id int, fixture GameFixture) potatovn.GameInfo {
	info := potatovn.GameInfo{
		ID:          id,
		VNDBID:      fixture.VNDBID,
		BangumiID:   fixture.BangumiID,
		TitleJP:     fixture.TitleJP,
		TitleZH:     fixture.TitleZH,
		IntroZH:     fixture.IntroZH,
		ReleaseDate: fixture.ReleaseDate,
		Tags:        []string{},
	}
	for _, tag := range fixture.Tags {
		if tag.Alias != nil {
			info.Tags = append(info.Tags, *tag.Alias)
		} else {
			info.Tags = append(info.Tags, tag.Name)
		}
	}
	for _, cover := range fixture.Covers {
		if cover.Sexual == 0 && cover.Violence == 0 {
			key := cover.URL
			info.CoverKey = &key
			break
		}
	}
	return info
}
