package translator

import (
	"context"
	"strings"
	"unicode/utf8"

	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Get(ctx context.Context, id int) (Detail, error) {
	found, err := s.repo.Get(ctx, id)
	if err != nil {
		return Detail{}, err
	}
	works, err := s.repo.CountWorks(ctx, id)
	if err != nil {
		return Detail{}, err
	}
	return Detail{Translator: found, WorksCount: works}, nil
}

func (s *Service) List(ctx context.Context, query string, page Page) ([]Summary, int, error) {
	return s.repo.List(ctx, strings.TrimSpace(query), page)
}

func (s *Service) Suggest(ctx context.Context, query string) ([]Summary, error) {
	return s.repo.Suggest(ctx, strings.TrimSpace(query), suggestionLimit)
}

func (s *Service) Resolve(ctx context.Context, names []string, creatorID int) ([]Ref, error) {
	wanted := uniqueByKey(names)
	if len(wanted) > MaxPerResource {
		return nil, ErrTooMany.WithArgs(map[string]any{"max": MaxPerResource})
	}
	for _, name := range wanted {
		if utf8.RuneCountInString(name) > MaxNameLength {
			return nil, apperror.ErrValidationFailed.WithField("translators", "a translator name is too long")
		}
	}
	known, err := s.repo.FindByKeys(ctx, keysOf(wanted))
	if err != nil {
		return nil, err
	}
	byKey := map[string]Translator{}
	for _, found := range known {
		byKey[Key(found.Name)] = found
		for _, alias := range found.Aliases {
			byKey[Key(alias)] = found
		}
	}
	refs := make([]Ref, 0, len(wanted))
	listed := map[int]bool{}
	for _, name := range wanted {
		found, ok := byKey[Key(name)]
		if !ok {
			found, err = s.repo.Ensure(ctx, NewTranslator{Name: name, CreatorID: &creatorID})
			if err != nil {
				return nil, err
			}
		}
		if listed[found.ID] {
			continue
		}
		listed[found.ID] = true
		refs = append(refs, Ref{ID: found.ID, Name: found.Name})
	}
	return refs, nil
}
