package download

import "context"

type LegacyService struct {
	store       LegacyStore
	translators Translators
	tx          Transactor
}

func NewLegacyService(store LegacyStore, translators Translators, tx Transactor) *LegacyService {
	return &LegacyService{store: store, translators: translators, tx: tx}
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
		for _, resource := range resources {
			after = resource.ID
			reading := ReadLegacy(resource)
			if reading.Empty() {
				continue
			}
			if apply {
				if err := s.describe(ctx, resource, reading); err != nil {
					return tally, err
				}
			}
			tally.count(reading)
		}
	}
}

func (s *LegacyService) describe(ctx context.Context, resource LegacyResource, reading LegacyReading) error {
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		description := LegacyDescription{
			Translation: reading.Translation,
			ReleaseURL:  reading.ReleaseURL,
			Edition:     reading.Edition,
			Form:        reading.Form,
			ClearNote:   reading.ClearNote,
		}
		if len(reading.Translators) > 0 {
			credited, err := s.translators.Resolve(ctx, reading.Translators, resource.CreatorID)
			if err != nil {
				return err
			}
			description.Translators = credited
		}
		return s.store.Describe(ctx, resource.ID, description)
	})
}
