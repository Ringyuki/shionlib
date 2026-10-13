package translatortest

import (
	"cmp"
	"context"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/translator"
)

type credit struct {
	resourceID   int
	gameID       int
	translatorID int
	visible      bool
	at           time.Time
}

type Followers struct {
	Changed []int
}

func (f *Followers) TranslatorChanged(_ context.Context, id int) error {
	f.Changed = append(f.Changed, id)
	return nil
}

type MemoryRepository struct {
	mu           sync.Mutex
	nextID       int
	nextResource int
	items        map[int]translator.Translator
	credits      []credit
	distinct     map[translator.Distinction]bool
}

func NewMemoryRepository() *MemoryRepository {
	return &MemoryRepository{items: map[int]translator.Translator{}, distinct: map[translator.Distinction]bool{}}
}

func (r *MemoryRepository) Seed(item translator.Translator) translator.Translator {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.nextID++
	item.ID = r.nextID
	r.items[item.ID] = item
	return item
}

func (r *MemoryRepository) Credit(gameID int, visible bool, at time.Time, translatorIDs ...int) int {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.nextResource++
	for _, id := range translatorIDs {
		r.credits = append(r.credits, credit{resourceID: r.nextResource, gameID: gameID, translatorID: id, visible: visible, at: at})
	}
	return r.nextResource
}

func (r *MemoryRepository) Credited(resourceID int) []int {
	r.mu.Lock()
	defer r.mu.Unlock()
	var ids []int
	for _, c := range r.credits {
		if c.resourceID == resourceID {
			ids = append(ids, c.translatorID)
		}
	}
	return ids
}

func (r *MemoryRepository) Get(_ context.Context, id int) (translator.Translator, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	item, ok := r.items[id]
	if !ok {
		return translator.Translator{}, translator.ErrNotFound
	}
	return item, nil
}

func (r *MemoryRepository) Lock(ctx context.Context, id int) (translator.Translator, error) {
	return r.Get(ctx, id)
}

func (r *MemoryRepository) FindByKeys(_ context.Context, keys []string) ([]translator.Translator, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	var found []translator.Translator
	for _, item := range r.sorted() {
		if slices.ContainsFunc(append([]string{item.Name}, item.Aliases...), func(name string) bool { return slices.Contains(keys, translator.Key(name)) }) {
			found = append(found, item)
		}
	}
	return found, nil
}

func (r *MemoryRepository) sorted() []translator.Translator {
	items := make([]translator.Translator, 0, len(r.items))
	for _, item := range r.items {
		items = append(items, item)
	}
	slices.SortFunc(items, func(a, b translator.Translator) int { return cmp.Compare(a.ID, b.ID) })
	return items
}

func (r *MemoryRepository) Ensure(_ context.Context, in translator.NewTranslator) (translator.Translator, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, item := range r.sorted() {
		if translator.Key(item.Name) == translator.Key(in.Name) {
			return item, nil
		}
	}
	r.nextID++
	item := translator.Translator{ID: r.nextID, Name: in.Name, Aliases: []string{}, CreatorID: in.CreatorID}
	r.items[item.ID] = item
	return item, nil
}

func (r *MemoryRepository) Update(_ context.Context, id int, changes translator.Changes) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	item, ok := r.items[id]
	if !ok {
		return translator.ErrNotFound
	}
	if changes.Name != nil {
		for _, other := range r.items {
			if other.ID != id && translator.Key(other.Name) == translator.Key(*changes.Name) {
				return translator.ErrNameTaken
			}
		}
		item.Name = *changes.Name
	}
	if changes.Aliases != nil {
		item.Aliases = slices.Clone(*changes.Aliases)
	}
	if changes.Homepage.Set {
		item.Homepage = changes.Homepage.Value
	}
	r.items[id] = item
	return nil
}

func (r *MemoryRepository) Delete(_ context.Context, id int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.items[id]; !ok {
		return translator.ErrNotFound
	}
	delete(r.items, id)
	r.credits = slices.DeleteFunc(r.credits, func(c credit) bool { return c.translatorID == id })
	return nil
}

func (r *MemoryRepository) works(id int) int {
	games := map[int]bool{}
	for _, c := range r.credits {
		if c.translatorID == id && c.visible {
			games[c.gameID] = true
		}
	}
	return len(games)
}

func (r *MemoryRepository) resources(id int) int {
	count := 0
	for _, c := range r.credits {
		if c.translatorID == id {
			count++
		}
	}
	return count
}

func (r *MemoryRepository) latest(id int) *time.Time {
	var latest *time.Time
	for _, c := range r.credits {
		if c.translatorID == id && (latest == nil || c.at.After(*latest)) {
			at := c.at
			latest = &at
		}
	}
	return latest
}

func matches(item translator.Translator, query string) bool {
	needle := strings.ToLower(query)
	return slices.ContainsFunc(append([]string{item.Name}, item.Aliases...), func(name string) bool { return strings.Contains(strings.ToLower(name), needle) })
}

func (r *MemoryRepository) summaries(query string, withoutWorks bool) []translator.Summary {
	var out []translator.Summary
	for _, item := range r.sorted() {
		works := r.works(item.ID)
		if (works == 0 && !withoutWorks) || (query != "" && !matches(item, query)) {
			continue
		}
		out = append(out, translator.Summary{ID: item.ID, Name: item.Name, Aliases: slices.Clone(item.Aliases), WorksCount: works})
	}
	slices.SortStableFunc(out, func(a, b translator.Summary) int {
		return cmp.Or(cmp.Compare(b.WorksCount, a.WorksCount), cmp.Compare(a.Name, b.Name), cmp.Compare(a.ID, b.ID))
	})
	return out
}

func (r *MemoryRepository) List(_ context.Context, query string, page translator.Page) ([]translator.Summary, int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	all := r.summaries(query, false)
	start := min(max(page.Offset(), 0), len(all))
	end := min(start+page.Size, len(all))
	return slices.Clone(all[start:end]), len(all), nil
}

func (r *MemoryRepository) Suggest(_ context.Context, query string, limit int) ([]translator.Summary, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	all := r.summaries(query, true)
	return slices.Clone(all[:min(limit, len(all))]), nil
}

func (r *MemoryRepository) CountWorks(_ context.Context, id int) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.works(id), nil
}

func (r *MemoryRepository) Reassign(_ context.Context, fromID, toID int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	held := map[int]bool{}
	for _, c := range r.credits {
		if c.translatorID == toID {
			held[c.resourceID] = true
		}
	}
	kept := r.credits[:0]
	for _, c := range r.credits {
		if c.translatorID == fromID {
			if held[c.resourceID] {
				continue
			}
			c.translatorID = toID
		}
		kept = append(kept, c)
	}
	r.credits = kept
	return nil
}

func (r *MemoryRepository) entries() []translator.AdminEntry {
	out := make([]translator.AdminEntry, 0, len(r.items))
	for _, item := range r.sorted() {
		out = append(out, translator.AdminEntry{
			ID: item.ID, Name: item.Name, Aliases: slices.Clone(item.Aliases), Homepage: item.Homepage,
			WorksCount: r.works(item.ID), ResourcesCount: r.resources(item.ID), LatestCredit: r.latest(item.ID),
		})
	}
	return out
}

func (r *MemoryRepository) Search(_ context.Context, filter translator.AdminFilter, page translator.Page) ([]translator.AdminEntry, int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	all := slices.DeleteFunc(r.entries(), func(entry translator.AdminEntry) bool {
		return filter.Search != "" && !matches(translator.Translator{Name: entry.Name, Aliases: entry.Aliases}, filter.Search)
	})
	slices.SortStableFunc(all, func(a, b translator.AdminEntry) int {
		var order int
		switch filter.SortBy {
		case translator.SortByResources:
			order = cmp.Compare(a.ResourcesCount, b.ResourcesCount)
		case translator.SortByLatest:
			order = compareTimes(a.LatestCredit, b.LatestCredit)
		case translator.SortByName:
			order = cmp.Compare(a.Name, b.Name)
		default:
			order = cmp.Compare(a.WorksCount, b.WorksCount)
		}
		if filter.Descending {
			order = -order
		}
		return cmp.Or(order, cmp.Compare(a.ID, b.ID))
	})
	start := min(max(page.Offset(), 0), len(all))
	end := min(start+page.Size, len(all))
	return slices.Clone(all[start:end]), len(all), nil
}

func compareTimes(a, b *time.Time) int {
	switch {
	case a == nil && b == nil:
		return 0
	case a == nil:
		return -1
	case b == nil:
		return 1
	default:
		return a.Compare(*b)
	}
}

func (r *MemoryRepository) Scan(_ context.Context, limit int) ([]translator.AdminEntry, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	all := r.entries()
	return all[:min(limit, len(all))], nil
}

func (r *MemoryRepository) Distinctions(context.Context) ([]translator.Distinction, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]translator.Distinction, 0, len(r.distinct))
	for pair := range r.distinct {
		out = append(out, pair)
	}
	slices.SortFunc(out, func(a, b translator.Distinction) int {
		return cmp.Or(cmp.Compare(a.LowID, b.LowID), cmp.Compare(a.HighID, b.HighID))
	})
	return out, nil
}

func (r *MemoryRepository) AddDistinctions(_ context.Context, pairs []translator.Distinction) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, pair := range pairs {
		r.distinct[pair] = true
	}
	return nil
}
