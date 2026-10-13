package download

import (
	"context"
	"errors"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/translator"
)

type NameService struct {
	repo  Repository
	games GameCards
	media Media
	tx    Transactor
}

func NewNameService(repo Repository, games GameCards, media Media, tx Transactor) *NameService {
	return &NameService{repo: repo, games: games, media: media, tx: tx}
}

func (s *NameService) Preview(ctx context.Context, in NamePreview) (FileName, error) {
	source, err := s.source(ctx, in.GameID)
	if err != nil {
		return FileName{}, err
	}
	settled, err := in.Info.settled(in.Languages, false)
	if err != nil {
		return FileName{}, err
	}
	info := settled.with(nil)
	for _, name := range settled.Translators {
		info.Translators = append(info.Translators, translator.Ref{Name: name})
	}
	input := NameInput{Source: source, Languages: in.Languages, Info: info, Uploaded: in.Uploaded}
	if in.ResourceID == nil {
		input.Medium = NamedMedium(in.Uploaded)
		return CanonicalName(input), nil
	}
	resource, err := s.repo.GetResource(ctx, *in.ResourceID)
	if err != nil {
		return FileName{}, err
	}
	files, err := s.repo.ListFiles(ctx, resource.ID)
	if err != nil {
		return FileName{}, err
	}
	main := mainFiles(files)
	if len(main) == 0 || resource.GameID != in.GameID || resource.Status != ResourceActive {
		return FileName{}, ErrResourceNotFound
	}
	input.Uploaded = main[0].uploadedName()
	if input.Medium, err = s.medium(ctx, main[0]); err != nil {
		return FileName{}, err
	}
	return CanonicalName(input), nil
}

func (s *NameService) Apply(ctx context.Context, resourceID int) error {
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		resource, err := s.repo.LockResource(ctx, resourceID)
		if errors.Is(err, ErrResourceNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		if resource.Status != ResourceActive || !resource.Published() || !resource.Canonical {
			return nil
		}
		files, err := s.repo.ListFiles(ctx, resourceID)
		if err != nil {
			return err
		}
		main := mainFiles(files)
		if len(main) == 0 {
			return nil
		}
		source, err := s.source(ctx, resource.GameID)
		if err != nil {
			return err
		}
		medium, err := s.medium(ctx, main[0])
		if err != nil {
			return err
		}
		return s.rename(ctx, files, main, func(file File) (string, bool) {
			name := CanonicalName(NameInput{Source: source, Languages: resource.Languages, Info: resource.Info, Medium: medium, Uploaded: file.uploadedName()})
			return name.String(), !name.Pending
		})
	})
}

func (s *NameService) Names(ctx context.Context, file File) (bool, error) {
	resource, err := s.repo.GetResource(ctx, file.ResourceID)
	if err != nil || !resource.Canonical {
		return false, err
	}
	files, err := s.repo.ListFiles(ctx, file.ResourceID)
	if err != nil {
		return false, err
	}
	for _, named := range mainFiles(files) {
		if named.ID == file.ID {
			return true, nil
		}
	}
	return false, nil
}

func (s *NameService) Restore(ctx context.Context, resourceID int) error {
	files, err := s.repo.ListFiles(ctx, resourceID)
	if err != nil {
		return err
	}
	return s.rename(ctx, files, mainFiles(files), func(file File) (string, bool) {
		return file.uploadedName(), true
	})
}

func (s *NameService) ApplyGame(ctx context.Context, gameID int) error {
	resources, err := s.repo.ListGameResources(ctx, gameID)
	if err != nil {
		return err
	}
	for _, resource := range resources {
		if err := s.Apply(ctx, resource.ID); err != nil {
			return err
		}
	}
	return nil
}

func (s *NameService) ApplyTranslator(ctx context.Context, translatorID int) error {
	ids, err := s.repo.ListCreditedResources(ctx, translatorID)
	if err != nil {
		return err
	}
	for _, id := range ids {
		if err := s.Apply(ctx, id); err != nil {
			return err
		}
	}
	return nil
}

func (s *NameService) Rename(ctx context.Context, job RenameFiles) error {
	if job.TranslatorID > 0 {
		if err := s.ApplyTranslator(ctx, job.TranslatorID); err != nil {
			return err
		}
	}
	if job.GameID > 0 {
		return s.ApplyGame(ctx, job.GameID)
	}
	return nil
}

func (s *NameService) rename(ctx context.Context, files, main []File, wanted func(File) (string, bool)) error {
	taken := make(map[string]int, len(files))
	for _, file := range files {
		taken[file.Name] = file.ID
	}
	for _, file := range main {
		name, known := wanted(file)
		if !known || name == "" || name == file.Name {
			continue
		}
		if holder, used := taken[name]; used && holder != file.ID {
			continue
		}
		if err := s.repo.RenameFile(ctx, file.ID, name); err != nil {
			return err
		}
		delete(taken, file.Name)
		taken[name] = file.ID
	}
	return nil
}

func (s *NameService) source(ctx context.Context, gameID int) (NameSource, error) {
	cards, err := s.games.ByIDs(ctx, []int{gameID}, actor.Actor{})
	if err != nil {
		return NameSource{}, err
	}
	card, found := cards[gameID]
	if !found {
		return NameSource{}, game.ErrNotFound
	}
	return SourceOf(card), nil
}

func (s *NameService) medium(ctx context.Context, file File) (string, error) {
	if file.InspectionID != nil {
		medium, err := s.media.Medium(ctx, *file.InspectionID)
		if err != nil || medium != "" {
			return medium, err
		}
	}
	return NamedMedium(file.uploadedName()), nil
}
