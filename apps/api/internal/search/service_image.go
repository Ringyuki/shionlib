package search

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"slices"
	"strings"

	"golang.org/x/sync/errgroup"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
	"github.com/Ringyuki/shionlib/apps/api/internal/character"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

type ImageDeps struct {
	Finder     Finder
	Recognizer Recognizer
	Pictures   Pictures
	Cache      Cache
}

type ImageService struct {
	finder     Finder
	recognizer Recognizer
	pictures   Pictures
	cache      Cache
}

func NewImageService(deps ImageDeps) *ImageService {
	return &ImageService{finder: deps.Finder, recognizer: deps.Recognizer, pictures: deps.Pictures, cache: deps.Cache}
}

func (s *ImageService) Source() ImageSource {
	return s.recognizer.Source()
}

func (s *ImageService) Search(ctx context.Context, viewer actor.Actor, image []byte) (ImageResults, error) {
	if len(image) == 0 {
		return ImageResults{}, ErrImageMissing
	}
	if len(image) > ImageMaxBytes {
		return ImageResults{}, ErrImageTooLarge.WithArgs(map[string]any{"max": ImageMaxBytes >> 20})
	}
	sightings, err := s.sightings(ctx, image)
	if err != nil {
		return ImageResults{}, err
	}
	return s.match(ctx, viewer, sightings)
}

func (s *ImageService) sightings(ctx context.Context, image []byte) ([]Sighting, error) {
	digest := sha256.Sum256(image)
	key := "search:image:" + strings.ToLower(s.recognizer.Source().Name) + ":" + hex.EncodeToString(digest[:])
	var cached []Sighting
	if found, err := s.cache.Get(ctx, key, &cached); err == nil && found {
		return cached, nil
	}
	shrunk, err := s.pictures.Shrink(ctx, image, ImageLongestSide)
	if err != nil {
		if ctxErr := ctx.Err(); ctxErr != nil {
			return nil, ctxErr
		}
		return nil, ErrImageUnsupported.Wrap(err)
	}
	sightings, err := s.recognizer.Recognize(ctx, shrunk)
	if err != nil {
		return nil, err
	}
	_ = s.cache.Set(ctx, key, sightings, ImageCacheTTL)
	return sightings, nil
}

func (s *ImageService) match(ctx context.Context, viewer actor.Actor, sightings []Sighting) (ImageResults, error) {
	works := worksOf(sightings)
	cards := make([]*game.Card, len(works))
	group, groupCtx := errgroup.WithContext(ctx)
	group.SetLimit(ImageLookups)
	for i, work := range works {
		group.Go(func() error {
			card, err := s.game(groupCtx, viewer, work)
			cards[i] = card
			return err
		})
	}
	if err := group.Wait(); err != nil {
		return ImageResults{}, err
	}
	results := ImageResults{Source: s.recognizer.Source(), Games: []game.Card{}, Unlisted: []string{}, Characters: make([]Spotted, len(sightings))}
	byWork := make(map[string]*game.Card, len(works))
	for i, work := range works {
		byWork[work] = cards[i]
		switch {
		case cards[i] == nil:
			results.Unlisted = append(results.Unlisted, work)
		case !slices.ContainsFunc(results.Games, func(listed game.Card) bool { return listed.ID == cards[i].ID }):
			results.Games = append(results.Games, *cards[i])
		}
	}
	group, groupCtx = errgroup.WithContext(ctx)
	group.SetLimit(ImageLookups)
	for i, sighting := range sightings {
		results.Characters[i] = Spotted{Sighting: sighting}
		card := byWork[sighting.Work]
		if card == nil {
			continue
		}
		gameID := card.ID
		results.Characters[i].GameID = &gameID
		group.Go(func() error {
			found, err := s.character(groupCtx, viewer, sighting.Name, gameID)
			results.Characters[i].Character = found
			return err
		})
	}
	if err := group.Wait(); err != nil {
		return ImageResults{}, err
	}
	return results, nil
}

func worksOf(sightings []Sighting) []string {
	works := []string{}
	for _, sighting := range sightings {
		if sighting.Work != "" && !slices.Contains(works, sighting.Work) {
			works = append(works, sighting.Work)
		}
	}
	return works
}

func (s *ImageService) game(ctx context.Context, viewer actor.Actor, work string) (*game.Card, error) {
	found, err := s.finder.Search(ctx, viewer, Query{Q: work, Kinds: []catalog.Entity{catalog.EntityGame}, Page: 1, Size: 1, Resources: game.ResourcesAny})
	if err != nil || len(found.Games.Items) == 0 {
		return nil, err
	}
	return &found.Games.Items[0], nil
}

func (s *ImageService) character(ctx context.Context, viewer actor.Actor, name string, gameID int) (*character.Summary, error) {
	if strings.TrimSpace(name) == "" {
		return nil, nil
	}
	found, err := s.finder.Search(ctx, viewer, Query{Q: name, Kinds: []catalog.Entity{catalog.EntityCharacter}, Page: 1, Size: CharacterCandidates})
	if err != nil {
		return nil, err
	}
	index := slices.IndexFunc(found.Characters.Items, func(summary character.Summary) bool {
		return summary.Game != nil && summary.Game.ID == gameID
	})
	if index < 0 {
		return nil, nil
	}
	return &found.Characters.Items[index], nil
}
