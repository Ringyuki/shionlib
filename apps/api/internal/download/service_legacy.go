package download

import (
	"context"
	"errors"
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
)

type LegacyService struct {
	store       LegacyStore
	games       GameCards
	translators Translators
	names       *NameService
	tx          Transactor
}

func NewLegacyService(store LegacyStore, games GameCards, translators Translators, names *NameService, tx Transactor) *LegacyService {
	return &LegacyService{store: store, games: games, translators: translators, names: names, tx: tx}
}

func (s *LegacyService) Describe(ctx context.Context) error {
	var errs []error
	after := 0
	for {
		resources, err := s.store.ListUndescribed(ctx, after, legacyBatch)
		if err != nil || len(resources) == 0 {
			return errors.Join(append(errs, err)...)
		}
		gameIDs := make([]int, len(resources))
		for i, resource := range resources {
			gameIDs[i] = resource.GameID
		}
		cards, err := s.games.ByIDs(ctx, gameIDs, actor.Actor{})
		if err != nil {
			return errors.Join(append(errs, err)...)
		}
		for _, resource := range resources {
			after = resource.ID
			if err := ctx.Err(); err != nil {
				return errors.Join(append(errs, err)...)
			}
			if err := s.describe(ctx, resource, ReadLegacy(resource, LegacyEntryOf(cards[resource.GameID]))); err != nil {
				errs = append(errs, fmt.Errorf("describe resource %d: %w", resource.ID, err))
			}
		}
	}
}

func (s *LegacyService) describe(ctx context.Context, resource LegacyResource, reading LegacyReading) error {
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		description := LegacyDescription{
			Translation: reading.Translation,
			ReleaseURL:  reading.ReleaseURL,
			Edition:     reading.Edition,
			EditionName: reading.EditionName,
			Form:        reading.Form,
			ClearNote:   reading.ClearNote,
			Canonical:   reading.Canonical,
		}
		if len(reading.Translators) > 0 {
			credited, err := s.translators.Resolve(ctx, reading.Translators, resource.CreatorID)
			if err != nil {
				return err
			}
			description.Translators = credited
		}
		if err := s.store.Describe(ctx, resource.ID, description); err != nil {
			return err
		}
		if len(reading.Canonical) == 0 {
			return nil
		}
		return s.names.Apply(ctx, resource.ID)
	})
}
