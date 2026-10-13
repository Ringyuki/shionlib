package download

import (
	"context"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
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

func (s *LegacyService) Describe(ctx context.Context, apply bool) (LegacyTally, error) {
	tally := LegacyTally{Translations: map[Translation]int{}, Editions: map[Edition]int{}, Translators: map[string]int{}}
	after := 0
	for {
		resources, err := s.store.ListLegacy(ctx, after, legacyBatch)
		if err != nil {
			return tally, err
		}
		if len(resources) == 0 {
			return tally, nil
		}
		gameIDs := make([]int, len(resources))
		for i, resource := range resources {
			gameIDs[i] = resource.GameID
		}
		cards, err := s.games.ByIDs(ctx, gameIDs, actor.Actor{})
		if err != nil {
			return tally, err
		}
		for _, resource := range resources {
			after = resource.ID
			card := cards[resource.GameID]
			reading := ReadLegacy(resource, LegacyEntryOf(card))
			if reading.Empty() {
				continue
			}
			if apply {
				if err := s.describe(ctx, resource, reading); err != nil {
					return tally, err
				}
			}
			tally.count(reading)
			tally.sample(resource, reading, card)
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

func (t *LegacyTally) sample(resource LegacyResource, reading LegacyReading, card game.Card) {
	if len(reading.Canonical) == 0 || len(t.Renames) >= legacyRenameSample {
		return
	}
	for _, file := range resource.Files {
		if file.ID != reading.Canonical[0] {
			continue
		}
		name := CanonicalName(NameInput{Source: SourceOf(card), Languages: resource.Languages, Info: reading.over(resource.Info), Medium: NamedMedium(file.Name), Uploaded: file.Name})
		if !name.Pending && name.String() != file.Name {
			t.Renames = append(t.Renames, LegacyRename{From: file.Name, To: name.String()})
		}
	}
}
