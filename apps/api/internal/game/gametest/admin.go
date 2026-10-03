package gametest

import (
	"cmp"
	"context"
	"encoding/json"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

type AdminGame struct {
	Entry  game.AdminEntry
	Scalar game.Scalar
	Keys   []string
}

type AdminStore struct {
	mu    sync.Mutex
	games map[int]*AdminGame
}

func NewAdminStore(games ...AdminGame) *AdminStore {
	store := &AdminStore{games: map[int]*AdminGame{}}
	for _, g := range games {
		g.Scalar.Status = g.Entry.Status
		g.Scalar.TitleJP = cmp.Or(g.Scalar.TitleJP, g.Entry.TitleJP)
		store.games[g.Entry.ID] = &g
	}
	return store
}

func (s *AdminStore) Game(id int) (AdminGame, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	g, ok := s.games[id]
	if !ok {
		return AdminGame{}, false
	}
	return *g, true
}

func (s *AdminStore) Search(_ context.Context, filter game.AdminFilter, page game.Page) ([]game.AdminEntry, int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var matched []game.AdminEntry
	for _, g := range s.games {
		if filter.Status != nil && g.Entry.Status != *filter.Status {
			continue
		}
		if filter.Search != "" && !matchesTitle(g.Entry, filter.Search) {
			continue
		}
		matched = append(matched, g.Entry)
	}
	slices.SortFunc(matched, func(a, b game.AdminEntry) int {
		order := cmp.Or(compareBy(a, b, filter.SortBy), cmp.Compare(a.ID, b.ID))
		if filter.Descending {
			return -order
		}
		return order
	})
	start := min(page.Offset(), len(matched))
	end := min(start+page.Size, len(matched))
	return slices.Clone(matched[start:end]), len(matched), nil
}

func matchesTitle(entry game.AdminEntry, search string) bool {
	needle := strings.ToLower(search)
	for _, title := range []string{entry.TitleJP, entry.TitleZH, entry.TitleEN} {
		if strings.Contains(strings.ToLower(title), needle) {
			return true
		}
	}
	return false
}

func compareBy(a, b game.AdminEntry, field game.AdminSortField) int {
	switch field {
	case game.AdminSortByTitleJP:
		return cmp.Compare(a.TitleJP, b.TitleJP)
	case game.AdminSortByViews:
		return cmp.Compare(a.Views, b.Views)
	case game.AdminSortByDownloads:
		return cmp.Compare(a.Downloads, b.Downloads)
	case game.AdminSortByCreated:
		return a.Created.Compare(b.Created)
	case game.AdminSortByUpdated:
		return a.Updated.Compare(b.Updated)
	default:
		return 0
	}
}

func (s *AdminStore) Scalar(_ context.Context, id int) (game.Scalar, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	g, ok := s.games[id]
	if !ok {
		return game.Scalar{}, game.ErrNotFound
	}
	return g.Scalar, nil
}

func (s *AdminStore) Lock(_ context.Context, id int) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.games[id]; !ok {
		return game.ErrNotFound
	}
	return nil
}

func (s *AdminStore) SetStatus(_ context.Context, id int, status game.Status) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	g, ok := s.games[id]
	if !ok {
		return game.ErrNotFound
	}
	g.Entry.Status, g.Scalar.Status = status, status
	return nil
}

func (s *AdminStore) UpdateScalar(_ context.Context, id int, c game.ScalarChanges) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	g, ok := s.games[id]
	if !ok {
		return game.ErrNotFound
	}
	next := g.Scalar
	applyClearable(&next.BID, c.BID)
	applyClearable(&next.VID, c.VID)
	applyClearable(&next.Type, c.Type)
	applyClearable(&next.ReleaseDate, c.ReleaseDate)
	applyValue(&next.TitleJP, c.TitleJP)
	applyValue(&next.TitleZH, c.TitleZH)
	applyValue(&next.TitleEN, c.TitleEN)
	applyValue(&next.IntroJP, c.IntroJP)
	applyValue(&next.IntroZH, c.IntroZH)
	applyValue(&next.IntroEN, c.IntroEN)
	applyValue(&next.Aliases, c.Aliases)
	applyValue(&next.Platform, c.Platform)
	applyValue(&next.ReleaseDateTBA, c.ReleaseDateTBA)
	applyValue(&next.NSFW, c.NSFW)
	applyValue(&next.Status, c.Status)
	if c.ExtraInfo.Set {
		next.ExtraInfo = mustJSON(*c.ExtraInfo.Value)
	}
	if c.Staffs.Set {
		next.Staffs = mustJSON(*c.Staffs.Value)
	}
	if next.BID != nil && next.VID != nil {
		for otherID, other := range s.games {
			if otherID != id && other.Scalar.BID != nil && other.Scalar.VID != nil && *other.Scalar.BID == *next.BID && *other.Scalar.VID == *next.VID {
				return game.ErrAlreadyExists
			}
		}
	}
	g.Scalar = next
	g.Entry.TitleJP, g.Entry.TitleZH, g.Entry.TitleEN = next.TitleJP, next.TitleZH, next.TitleEN
	g.Entry.NSFW, g.Entry.Status = next.NSFW, next.Status
	return nil
}

func applyClearable[T any](dst **T, value game.Clearable[T]) {
	if value.Set {
		*dst = value.Value
	}
}

func applyValue[T any](dst *T, value *T) {
	if value != nil {
		*dst = *value
	}
}

func mustJSON(value any) json.RawMessage {
	raw, err := json.Marshal(value)
	if err != nil {
		panic(err)
	}
	return raw
}

func (s *AdminStore) StorageKeys(_ context.Context, id int) ([]string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	g, ok := s.games[id]
	if !ok {
		return nil, nil
	}
	return slices.Clone(g.Keys), nil
}

func (s *AdminStore) Delete(_ context.Context, id int) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.games[id]; !ok {
		return game.ErrNotFound
	}
	delete(s.games, id)
	return nil
}

type RecentMarks struct {
	mu     sync.Mutex
	marked map[int]time.Time
}

func NewRecentMarks() *RecentMarks {
	return &RecentMarks{marked: map[int]time.Time{}}
}

func (r *RecentMarks) Add(_ context.Context, gameID int, at time.Time) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.marked[gameID] = at
	return nil
}

func (r *RecentMarks) Remove(_ context.Context, gameID int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.marked, gameID)
	return nil
}

func (r *RecentMarks) MarkedAt(gameID int) (time.Time, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	at, ok := r.marked[gameID]
	return at, ok
}

type Exclusion struct {
	Entity catalog.Entity
	ID     int
}

type Exclusions struct {
	mu       sync.Mutex
	excluded []Exclusion
}

func (e *Exclusions) Exclude(_ context.Context, entity catalog.Entity, localID int) error {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.excluded = append(e.excluded, Exclusion{Entity: entity, ID: localID})
	return nil
}

func (e *Exclusions) Excluded() []Exclusion {
	e.mu.Lock()
	defer e.mu.Unlock()
	return slices.Clone(e.excluded)
}

type Purger struct {
	mu     sync.Mutex
	purged [][]string
}

func (p *Purger) PurgeLater(_ context.Context, keys []string) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if len(keys) > 0 {
		p.purged = append(p.purged, slices.Clone(keys))
	}
	return nil
}

func (p *Purger) Purged() [][]string {
	p.mu.Lock()
	defer p.mu.Unlock()
	return slices.Clone(p.purged)
}

type SearchIndex struct {
	mu      sync.Mutex
	Changed []int
}

func (i *SearchIndex) GamesChanged(_ context.Context, ids []int) error {
	i.mu.Lock()
	defer i.mu.Unlock()
	i.Changed = append(i.Changed, ids...)
	return nil
}
