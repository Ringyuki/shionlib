package catalog

import (
	"context"
	"errors"
	"fmt"
	"time"
)

type ImportJob struct {
	Source     string `json:"source"`
	Entity     Entity `json:"entity"`
	ExternalID string `json:"external_id"`
}

const (
	ImportQueue       = "catalog"
	importMaxAttempts = 5
)

func (ImportJob) Kind() string {
	return "catalog_import"
}

func (ImportJob) Queue() string {
	return ImportQueue
}

func (ImportJob) MaxAttempts() int {
	return importMaxAttempts
}

func (ImportJob) UniqueByArgs() bool {
	return true
}

type Options struct {
	CreatorID    int
	RefreshAfter time.Duration
	RefreshBatch int
	ChangesBatch int
}

type Deps struct {
	Sources []Source
	Store   Store
	Tx      Transactor
	Queue   Queue
	Indexer Indexer
	Now     func() time.Time
	Options Options
}

type Service struct {
	sources map[string]Source
	store   Store
	tx      Transactor
	queue   Queue
	indexer Indexer
	now     func() time.Time
	opts    Options
}

func NewService(deps Deps) *Service {
	byName := make(map[string]Source, len(deps.Sources))
	for _, source := range deps.Sources {
		byName[source.Name()] = source
	}
	indexer := deps.Indexer
	if indexer == nil {
		indexer = noIndex{}
	}
	return &Service{sources: byName, store: deps.Store, tx: deps.Tx, queue: deps.Queue, indexer: indexer, now: deps.Now, opts: deps.Options}
}

type noIndex struct{}

func (noIndex) GamesChanged(context.Context, []int) error {
	return nil
}

func (s *Service) source(name string) (Source, error) {
	source, ok := s.sources[name]
	if !ok {
		return nil, ErrUnknownSource.WithArgs(map[string]any{"source": name})
	}
	return source, nil
}

func (s *Service) Import(ctx context.Context, ref Ref) (int, error) {
	source, err := s.source(ref.Source)
	if err != nil {
		return 0, err
	}
	excluded, err := s.store.Excluded(ctx, ref)
	if err != nil {
		return 0, err
	}
	if excluded {
		return 0, ErrExcluded
	}
	write, err := s.fetch(ctx, source, ref)
	if errors.Is(err, ErrNotFound) {
		if err := s.store.MarkMissing(ctx, ref, ref.Entity == EntityGame, s.now()); err != nil {
			return 0, err
		}
		return 0, ErrEntryNotFound.New()
	}
	if errors.Is(err, ErrRateLimited) {
		return 0, err
	}
	var localID int
	var related []Ref
	if err == nil {
		err = s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
			var applyErr error
			localID, related, applyErr = write(ctx)
			return applyErr
		})
	}
	if err != nil {
		if recordErr := s.store.RecordFailure(ctx, ref, err.Error(), s.now()); recordErr != nil {
			return 0, errors.Join(err, recordErr)
		}
		return 0, err
	}
	for _, next := range related {
		if err := s.queue.Enqueue(ctx, ImportJob(next)); err != nil {
			return localID, err
		}
	}
	return localID, s.reindex(ctx, ref.Entity, localID)
}

func (s *Service) reindex(ctx context.Context, entity Entity, localID int) error {
	if entity == EntityGame {
		return s.indexer.GamesChanged(ctx, []int{localID})
	}
	ids, err := s.store.RelatedGames(ctx, entity, localID)
	if err != nil {
		return err
	}
	return s.indexer.GamesChanged(ctx, ids)
}

type writeFunc func(ctx context.Context) (int, []Ref, error)

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

func (s *Service) ImportNow(ctx context.Context, ref Ref) (int, error) {
	if _, err := s.source(ref.Source); err != nil {
		return 0, err
	}
	if err := s.store.Include(ctx, ref); err != nil {
		return 0, err
	}
	return s.Import(ctx, ref)
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

func (s *Service) Exclude(ctx context.Context, entity Entity, localID int) error {
	return s.store.Exclude(ctx, entity, localID, s.now())
}

func (s *Service) RefreshStale(ctx context.Context) error {
	before := s.now().Add(-s.opts.RefreshAfter)
	for name := range s.sources {
		refs, err := s.store.Stale(ctx, name, before, s.opts.RefreshBatch)
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
	for name, source := range s.sources {
		feed, ok := source.(ChangeFeed)
		if !ok {
			continue
		}
		if err := s.pull(ctx, name, feed); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) pull(ctx context.Context, name string, feed ChangeFeed) error {
	cursor, err := s.store.Cursor(ctx, name)
	if err != nil {
		return err
	}
	for {
		batch, err := feed.Changes(ctx, cursor, s.opts.ChangesBatch)
		if err != nil {
			return err
		}
		for _, change := range batch.Changes {
			if err := s.applyChange(ctx, name, change); err != nil {
				return err
			}
		}
		advanced := batch.Cursor != "" && batch.Cursor != cursor
		if advanced {
			cursor = batch.Cursor
			if err := s.store.SaveCursor(ctx, name, cursor); err != nil {
				return err
			}
		}
		if !batch.HasMore || !advanced {
			return nil
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

type SearchResult struct {
	Hits  []SearchHit
	Total int
}

func (s *Service) Search(ctx context.Context, sourceName, query string, page, size int) (SearchResult, error) {
	source, err := s.source(sourceName)
	if err != nil {
		return SearchResult{}, err
	}
	hits, total, err := source.SearchGames(ctx, query, page, size)
	if err != nil {
		return SearchResult{}, ErrSourceUnavailable.Wrap(err)
	}
	return SearchResult{Hits: hits, Total: total}, nil
}

func (s *Service) Sources() []string {
	names := make([]string, 0, len(s.sources))
	for name := range s.sources {
		names = append(names, name)
	}
	return names
}
