package charactertest

import (
	"context"
	"slices"
	"strings"
	"sync"

	"github.com/Ringyuki/shionlib/apps/api/internal/character"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

type appearance struct {
	character.Appearance
	hidden bool
}

type MemoryRepository struct {
	mu          sync.Mutex
	nextID      int
	nextGameID  int
	characters  map[int]character.Character
	links       map[int]int
	appearances map[int][]appearance
}

func NewMemoryRepository() *MemoryRepository {
	return &MemoryRepository{characters: map[int]character.Character{}, links: map[int]int{}, appearances: map[int][]appearance{}}
}

func (r *MemoryRepository) Seed(c character.Character) character.Character {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.nextID++
	c.ID = r.nextID
	r.characters[c.ID] = c
	return c
}

func (r *MemoryRepository) Link(characterID int) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.links[characterID]++
}

func (r *MemoryRepository) Appear(characterID int, role, actor *string, hidden bool) int {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.nextGameID++
	r.links[characterID]++
	appeared := character.Appearance{GameID: r.nextGameID, Role: game.CharacterRoleSide, Actor: actor}
	if role != nil {
		appeared.Role = *role
	}
	r.appearances[characterID] = append(r.appearances[characterID], appearance{Appearance: appeared, hidden: hidden})
	return r.nextGameID
}

func (r *MemoryRepository) Appearances(_ context.Context, id int) ([]character.Appearance, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	visible := []character.Appearance{}
	for _, appeared := range r.appearances[id] {
		if !appeared.hidden {
			visible = append(visible, appeared.Appearance)
		}
	}
	return visible, nil
}

func (r *MemoryRepository) List(_ context.Context, query string, page character.Page) ([]character.Character, int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	matched := []character.Character{}
	for _, c := range r.characters {
		if query == "" || matches(c, query) {
			matched = append(matched, c)
		}
	}
	slices.SortFunc(matched, func(a, b character.Character) int { return a.ID - b.ID })
	total := len(matched)
	start := min(max(page.Offset(), 0), total)
	end := min(start+page.Size, total)
	return matched[start:end], total, nil
}

func matches(c character.Character, query string) bool {
	needle := strings.ToLower(query)
	candidates := append([]string{c.NameJP, deref(c.NameZH), deref(c.NameEN)}, c.Aliases...)
	return slices.ContainsFunc(candidates, func(value string) bool {
		return strings.Contains(strings.ToLower(value), needle)
	})
}

func deref(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func (r *MemoryRepository) Get(_ context.Context, id int) (character.Character, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	c, ok := r.characters[id]
	if !ok {
		return character.Character{}, character.ErrNotFound
	}
	return c, nil
}

func (r *MemoryRepository) Lock(ctx context.Context, id int) (character.Character, error) {
	return r.Get(ctx, id)
}

func (r *MemoryRepository) HasRelations(_ context.Context, id int) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.links[id] > 0, nil
}

func (r *MemoryRepository) Delete(_ context.Context, id int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.characters[id]; !ok {
		return character.ErrNotFound
	}
	if r.links[id] > 0 {
		return character.ErrHasRelations
	}
	delete(r.characters, id)
	return nil
}
