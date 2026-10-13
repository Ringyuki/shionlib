package catalog

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
)

type Options struct {
	CreatorID int
}

type Deps struct {
	Sources   []Source
	Store     Store
	Tx        Transactor
	Queue     Queue
	Followers Followers
	Settings  setting.Source
	Now       func() time.Time
	Options   Options
}

type Service struct {
	sources   map[string]Source
	store     Store
	tx        Transactor
	queue     Queue
	followers Followers
	settings  setting.Source
	now       func() time.Time
	opts      Options
}

func NewService(deps Deps) *Service {
	byName := make(map[string]Source, len(deps.Sources))
	for _, source := range deps.Sources {
		byName[source.Name()] = source
	}
	return &Service{sources: byName, store: deps.Store, tx: deps.Tx, queue: deps.Queue, followers: deps.Followers, settings: deps.Settings, now: deps.Now, opts: deps.Options}
}

func (s *Service) source(name string) (Source, error) {
	source, ok := s.sources[name]
	if !ok {
		return nil, ErrUnknownSource.WithArgs(map[string]any{"source": name})
	}
	return source, nil
}

func (s *Service) Import(ctx context.Context, ref Ref) (int, error) {
	excluded, err := s.store.Excluded(ctx, ref)
	if err != nil {
		return 0, err
	}
	if excluded {
		return 0, ErrExcluded
	}
	return s.importEntry(ctx, ref, false)
}

func (s *Service) ImportNow(ctx context.Context, ref Ref) (int, error) {
	return s.importEntry(ctx, ref, true)
}

func (s *Service) importEntry(ctx context.Context, ref Ref, include bool) (int, error) {
	source, err := s.source(ref.Source)
	if err != nil {
		return 0, err
	}
	if !ref.Entity.Valid() || ref.ExternalID == "" {
		return 0, ErrEntryNotFound.New()
	}
	write, err := s.fetch(ctx, source, ref)
	if errors.Is(err, ErrNotFound) {
		if err := s.store.MarkMissing(ctx, ref, ref.Entity == EntityGame, s.now()); err != nil {
			return 0, err
		}
		return 0, ErrEntryNotFound.New()
	}
	if errors.Is(err, ErrRateLimited) {
		return 0, ErrSourceUnavailable.Wrap(err)
	}
	if err != nil {
		return 0, ErrSourceUnavailable.Wrap(s.recorded(ctx, ref, err))
	}
	var localID int
	var related []Ref
	err = s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		if include {
			if err := s.store.Include(ctx, ref); err != nil {
				return err
			}
		}
		var applyErr error
		localID, related, applyErr = write(ctx)
		return applyErr
	})
	if err != nil {
		return 0, s.recorded(ctx, ref, err)
	}
	for _, next := range related {
		if err := s.queue.Enqueue(ctx, ImportJob(next)); err != nil {
			return localID, err
		}
	}
	if ref.Entity == EntityGame {
		return localID, s.followers.GameImported(ctx, localID)
	}
	return localID, nil
}

func (s *Service) recorded(ctx context.Context, ref Ref, failure error) error {
	if err := s.store.RecordFailure(ctx, ref, failure.Error(), s.now()); err != nil {
		return errors.Join(failure, err)
	}
	return failure
}

func (s *Service) fetch(ctx context.Context, source Source, ref Ref) (writeFunc, error) {
	name := source.Name()
	switch ref.Entity {
	case EntityGame:
		snapshot, err := source.Game(ctx, ref.ExternalID)
		if err != nil {
			return nil, err
		}
		record := ToGameRecord(name, snapshot)
		return func(ctx context.Context) (int, []Ref, error) {
			return s.store.ApplyGame(ctx, name, record, s.opts.CreatorID, s.now())
		}, nil
	case EntityDeveloper:
		snapshot, err := source.Developer(ctx, ref.ExternalID)
		if err != nil {
			return nil, err
		}
		record := ToDeveloperRecord(name, snapshot)
		return func(ctx context.Context) (int, []Ref, error) {
			id, err := s.store.ApplyDeveloper(ctx, name, record, s.now())
			return id, nil, err
		}, nil
	case EntityCharacter:
		snapshot, err := source.Character(ctx, ref.ExternalID)
		if err != nil {
			return nil, err
		}
		record := ToCharacterRecord(name, snapshot)
		return func(ctx context.Context) (int, []Ref, error) {
			id, err := s.store.ApplyCharacter(ctx, name, record, s.now())
			return id, nil, err
		}, nil
	default:
		return nil, fmt.Errorf("unsupported catalog entity %q", ref.Entity)
	}
}

func (s *Service) Request(ctx context.Context, ref Ref) error {
	if _, err := s.source(ref.Source); err != nil {
		return err
	}
	if !ref.Entity.Valid() || ref.ExternalID == "" {
		return ErrEntryNotFound
	}
	if err := s.store.Include(ctx, ref); err != nil {
		return err
	}
	return s.queue.Enqueue(ctx, ImportJob(ref))
}

func (s *Service) Exclude(ctx context.Context, entity Entity, localID int, by Exclusion) error {
	return s.store.Exclude(ctx, entity, localID, by, s.now())
}

func (s *Service) ExcludedEntries(ctx context.Context, page, size int) ([]ExcludedEntry, int, error) {
	return s.store.ExcludedEntries(ctx, (max(page, 1)-1)*size, size)
}

func (s *Service) RefreshStale(ctx context.Context) error {
	before := s.now().Add(-RefreshInterval.Read(s.settings))
	for name := range s.sources {
		refs, err := s.store.Stale(ctx, name, before, RefreshBatch.Read(s.settings))
		if err != nil {
			return err
		}
		for _, ref := range refs {
			if err := s.queue.Enqueue(ctx, ImportJob(ref)); err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *Service) PullChanges(ctx context.Context) error {
	var errs []error
	for _, name := range s.Sources() {
		feed, ok := s.sources[name].(ChangeFeed)
		if !ok {
			continue
		}
		errs = append(errs, s.pull(ctx, name, feed))
	}
	return errors.Join(errs...)
}

func (s *Service) Sync(ctx context.Context, name string) (SourceStatus, error) {
	source, err := s.source(name)
	if err != nil {
		return SourceStatus{}, err
	}
	feed, ok := source.(ChangeFeed)
	if !ok {
		return SourceStatus{}, ErrNoChangeFeed.WithArgs(map[string]any{"source": name})
	}
	if err := s.pull(ctx, name, feed); err != nil {
		return SourceStatus{}, err
	}
	return s.status(ctx, name)
}

func (s *Service) Status(ctx context.Context) ([]SourceStatus, error) {
	names := s.Sources()
	statuses := make([]SourceStatus, len(names))
	for i, name := range names {
		status, err := s.status(ctx, name)
		if err != nil {
			return nil, err
		}
		statuses[i] = status
	}
	return statuses, nil
}

func (s *Service) status(ctx context.Context, name string) (SourceStatus, error) {
	counts, err := s.store.LinkCounts(ctx, name)
	if err != nil {
		return SourceStatus{}, err
	}
	state, err := s.store.SyncState(ctx, name)
	if err != nil {
		return SourceStatus{}, err
	}
	_, incremental := s.sources[name].(ChangeFeed)
	return SourceStatus{Name: name, Incremental: incremental, Counts: counts, Sync: state, Refreshes: RefreshInterval.Read(s.settings)}, nil
}

func (s *Service) pull(ctx context.Context, name string, feed ChangeFeed) error {
	cursor, err := s.store.Cursor(ctx, name)
	if err != nil {
		return err
	}
	applied := 0
	for {
		batch, err := feed.Changes(ctx, cursor, ChangesBatch.Read(s.settings))
		if err != nil {
			if recordErr := s.store.RecordPullFailure(ctx, name, err.Error(), s.now()); recordErr != nil {
				return errors.Join(err, recordErr)
			}
			return ErrSourceUnavailable.Wrap(err)
		}
		for _, change := range batch.Changes {
			if err := s.applyChange(ctx, name, change); err != nil {
				return err
			}
			applied++
		}
		advanced := batch.Cursor != "" && batch.Cursor != cursor
		if advanced {
			cursor = batch.Cursor
			if err := s.store.SaveCursor(ctx, name, cursor); err != nil {
				return err
			}
		}
		if !batch.HasMore || !advanced {
			return s.store.RecordPull(ctx, name, applied, s.now())
		}
	}
}

func (s *Service) applyChange(ctx context.Context, source string, change Change) error {
	ref := Ref{Source: source, Entity: change.Entity, ExternalID: change.ExternalID}
	switch change.Kind {
	case ChangeUpsert:
		if change.Entity != EntityGame {
			if _, linked, err := s.store.LocalID(ctx, ref); err != nil || !linked {
				return err
			}
		}
		return s.queue.Enqueue(ctx, ImportJob{Source: source, Entity: change.Entity, ExternalID: change.ExternalID})
	case ChangeDelete:
		return s.store.MarkMissing(ctx, ref, change.Entity == EntityGame, s.now())
	case ChangeMerge:
		if err := s.store.MarkMissing(ctx, ref, false, s.now()); err != nil {
			return err
		}
		if change.MergedInto == "" {
			return nil
		}
		return s.queue.Enqueue(ctx, ImportJob{Source: source, Entity: change.Entity, ExternalID: change.MergedInto})
	default:
		return nil
	}
}

func (s *Service) Search(ctx context.Context, sourceName string, entity Entity, query string, page, size int) (SearchResult, error) {
	source, err := s.source(sourceName)
	if err != nil {
		return SearchResult{}, err
	}
	hits, total, err := source.Search(ctx, entity, query, page, size)
	if err != nil {
		return SearchResult{}, ErrSourceUnavailable.Wrap(err)
	}
	externalIDs := make([]string, len(hits))
	for i, hit := range hits {
		externalIDs[i] = hit.ExternalID
	}
	links, err := s.store.Links(ctx, sourceName, entity, externalIDs)
	if err != nil {
		return SearchResult{}, err
	}
	annotated := slices.Clone(hits)
	for i := range annotated {
		if link, known := links[annotated[i].ExternalID]; known {
			annotated[i].Link = &link
		}
	}
	return SearchResult{Hits: annotated, Total: total}, nil
}

func (s *Service) Find(ctx context.Context, sourceName string, entity Entity, query string, page, size int) (SearchResult, error) {
	result, err := s.Search(ctx, sourceName, entity, query, page, size)
	if err != nil {
		return SearchResult{}, err
	}
	number := strings.TrimSpace(query)
	listed := slices.ContainsFunc(result.Hits, func(hit SearchHit) bool { return hit.ExternalID == number })
	if page > 1 || listed || !isNumber(number) {
		return result, nil
	}
	links, err := s.store.Links(ctx, sourceName, entity, []string{number})
	if err != nil {
		return SearchResult{}, err
	}
	numbered := SearchHit{ExternalID: number}
	if link, known := links[number]; known {
		numbered.Link = &link
	}
	result.Hits = append([]SearchHit{numbered}, result.Hits...)
	return result, nil
}

func isNumber(text string) bool {
	if text == "" {
		return false
	}
	for _, digit := range text {
		if digit < '0' || digit > '9' {
			return false
		}
	}
	return true
}

func (s *Service) Resolve(ctx context.Context, sourceName string, entity Entity, externalIDs []string) (map[string]int, error) {
	if _, err := s.source(sourceName); err != nil {
		return nil, err
	}
	links, err := s.store.Links(ctx, sourceName, entity, externalIDs)
	if err != nil {
		return nil, err
	}
	resolved := make(map[string]int, len(links))
	for _, externalID := range externalIDs {
		link, known := links[externalID]
		switch {
		case !known:
			if err := s.queue.Enqueue(ctx, ImportJob{Source: sourceName, Entity: entity, ExternalID: externalID}); err != nil {
				return nil, err
			}
		case !link.Excluded:
			resolved[externalID] = link.LocalID
		}
	}
	return resolved, nil
}

func (s *Service) Sources() []string {
	names := make([]string, 0, len(s.sources))
	for name := range s.sources {
		names = append(names, name)
	}
	slices.Sort(names)
	return names
}
