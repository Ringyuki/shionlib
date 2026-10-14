package download

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/activity"
	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

type ComposedService struct {
	files     *Service
	transfers *TransferService
}

func NewComposedService(files *Service, transfers *TransferService) *ComposedService {
	return &ComposedService{files: files, transfers: transfers}
}

func (c *ComposedService) Begin(ctx context.Context, who actor.Actor, draft ComposedDraft) (Resource, error) {
	s := c.files
	exists, err := s.games.Exists(ctx, draft.GameID)
	if err != nil {
		return Resource{}, err
	}
	if !exists {
		return Resource{}, game.ErrNotFound
	}
	info, err := draft.Info.settled(draft.Languages, true)
	if err != nil {
		return Resource{}, err
	}
	var created Resource
	err = s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		credited, err := s.translators.Resolve(ctx, info.Translators, who.UserID)
		if err != nil {
			return err
		}
		created, err = s.repo.CreateResource(ctx, NewResource{
			GameID:    draft.GameID,
			Platforms: draft.Platforms,
			Languages: draft.Languages,
			Simulator: draft.Simulator,
			Info:      info.with(credited),
			Canonical: true,
			CreatorID: who.UserID,
		})
		return err
	})
	return created, err
}

func (c *ComposedService) Owned(ctx context.Context, who actor.Actor, resourceID int) (GameResource, error) {
	resource, err := c.files.repo.GetGameResource(ctx, resourceID)
	if err != nil {
		return GameResource{}, err
	}
	if resource.Status != ResourceActive {
		return GameResource{}, ErrResourceNotFound
	}
	if resource.CreatorID != who.UserID && !who.AtLeast(actor.RoleAdmin) {
		return GameResource{}, ErrResourceNotOwner
	}
	return resource, nil
}

func (c *ComposedService) OfGame(ctx context.Context, viewer actor.Actor, gameID int) ([]GameResource, error) {
	resources, err := c.files.GameResources(ctx, viewer, gameID)
	if err != nil {
		return nil, err
	}
	return slices.DeleteFunc(resources, func(resource GameResource) bool { return !resource.Published() }), nil
}

func (c *ComposedService) Stored(ctx context.Context, resourceID int) (GameResource, error) {
	resource, err := c.files.repo.GetGameResource(ctx, resourceID)
	if err != nil {
		return GameResource{}, err
	}
	if resource.Status != ResourceActive || !resource.Published() {
		return GameResource{}, ErrResourceNotFound
	}
	return resource, nil
}

func (c *ComposedService) Discard(ctx context.Context, resourceID int) error {
	s := c.files
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		resource, err := s.repo.LockResource(ctx, resourceID)
		if errors.Is(err, ErrResourceNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		count, err := s.repo.CountFiles(ctx, resource.ID)
		if err != nil || resource.Published() || count > 0 {
			return err
		}
		return s.repo.DeleteResource(ctx, resource.ID)
	})
}

func (c *ComposedService) Publish(ctx context.Context, in ComposedFile) error {
	s := c.files
	file, published, err := c.adopt(ctx, in)
	if err != nil || published {
		return err
	}
	key := StorageKey(file.GameID, file.ID, file.Name)
	if err := c.transfers.store.Put(ctx, Object{Key: key, LocalPath: in.LocalPath, ContentType: upload.DefaultMimeType, Metadata: objectMetadata(file)}); err != nil {
		return err
	}
	err = s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		current, err := s.repo.LockFile(ctx, file.ID)
		if err != nil {
			return err
		}
		if current.Status == FileInObjectStore {
			return nil
		}
		if err := s.repo.CreateHistory(ctx, NewHistory{FileID: current.ID, Size: current.Size, HashAlgorithm: current.HashAlgorithm, Hash: current.Hash, StorageKey: &key, OperatorID: current.CreatorID}); err != nil {
			return err
		}
		if err := s.repo.MarkFileStored(ctx, current.ID, key); err != nil {
			return err
		}
		if err := s.activities.Record(ctx, fileActivity(activity.TypeFileUploadToS3, current.CreatorID, current.GameID, current.ID, FileInObjectStore, CheckOK, nil, nil)); err != nil {
			return err
		}
		return c.announce(ctx, current, in.Changes)
	})
	if err != nil {
		return err
	}
	_ = c.transfers.local.Remove(ctx, in.LocalPath)
	return nil
}

func (c *ComposedService) adopt(ctx context.Context, in ComposedFile) (File, bool, error) {
	s := c.files
	var adopted File
	published := false
	err := s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		resource, err := s.repo.LockResource(ctx, in.ResourceID)
		if err != nil {
			return err
		}
		if resource.Status != ResourceActive {
			return ErrResourceNotFound
		}
		if published = resource.Published(); published {
			return nil
		}
		leftovers, err := s.repo.ListFiles(ctx, resource.ID)
		if err != nil {
			return err
		}
		for _, leftover := range leftovers {
			if err := s.repo.DeleteFile(ctx, leftover.ID); err != nil {
				return err
			}
		}
		name := in.Name
		file, err := s.repo.CreateFile(ctx, NewFile{
			ResourceID:    resource.ID,
			Type:          FileTypeObjectStore,
			Name:          name,
			OriginalName:  &name,
			Path:          &in.LocalPath,
			Size:          in.Size,
			HashAlgorithm: upload.HashSHA256,
			Hash:          in.SHA256,
			Status:        FilePending,
			CreatorID:     resource.CreatorID,
		})
		if err != nil {
			return err
		}
		if err := s.repo.AdoptFile(ctx, file.ID, Adoption{InspectionID: in.InspectionID, SHA256: in.SHA256}); err != nil {
			return err
		}
		adopted, err = s.repo.GetFile(ctx, file.ID)
		return err
	})
	return adopted, published, err
}

func (c *ComposedService) announce(ctx context.Context, file File, changes []FieldChange) error {
	repo := c.files.repo
	published, err := repo.PublishIfReady(ctx, file.ResourceID, c.files.now())
	if err != nil {
		return err
	}
	if err := c.transfers.names.Apply(ctx, file.ResourceID); err != nil || !published {
		return err
	}
	resource, err := repo.GetResource(ctx, file.ResourceID)
	if err != nil {
		return err
	}
	files, err := repo.ListFiles(ctx, file.ResourceID)
	if err != nil {
		return err
	}
	listed := make([]EventFile, len(files))
	for i, stored := range files {
		listed[i] = EventFile{Name: stored.Name, Size: stored.Size}
	}
	return repo.CreateEvent(ctx, NewEvent{ResourceID: resource.ID, Kind: EventComposed, ActorID: &resource.CreatorID, Data: EventData{Files: listed, Changes: changes}})
}

func (c *ComposedService) Replace(ctx context.Context, in ComposedReplacement) error {
	s := c.files
	file, err := s.repo.GetFile(ctx, in.FileID)
	if err != nil {
		return err
	}
	if file.ResourceStatus != ResourceActive || file.Status != FileInObjectStore || file.StorageKey == nil {
		return fmt.Errorf("file %d: %w", file.ID, upload.ErrInvalidFileStatus)
	}
	before := s.now()
	key := StorageKey(file.GameID, file.ID, in.Name)
	replaced := file
	replaced.Hash, replaced.CreatorID = in.SHA256, in.OperatorID
	if err := c.transfers.store.Put(ctx, Object{Key: key, LocalPath: in.LocalPath, ContentType: upload.DefaultMimeType, Metadata: objectMetadata(replaced)}); err != nil {
		return err
	}
	done := false
	err = s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		current, err := s.repo.LockFile(ctx, file.ID)
		if err != nil {
			return err
		}
		if current.ResourceStatus != ResourceActive || current.Status != FileInObjectStore || current.StorageKey == nil || *current.StorageKey != *file.StorageKey {
			return fmt.Errorf("file %d changed while it was recomposed: %w", file.ID, upload.ErrInvalidFileStatus)
		}
		done = true
		return c.swap(ctx, current, key, in)
	})
	if err != nil || !done {
		return err
	}
	_ = c.transfers.local.Remove(ctx, in.LocalPath)
	return c.retire(ctx, *file.StorageKey, key, before)
}

func (c *ComposedService) swap(ctx context.Context, file File, key string, in ComposedReplacement) error {
	s := c.files
	who := actor.Actor{UserID: in.OperatorID}
	resource, err := s.repo.LockResource(ctx, file.ResourceID)
	if err != nil {
		return err
	}
	if err := s.repo.CreateHistory(ctx, NewHistory{FileID: file.ID, Size: in.Size, HashAlgorithm: upload.HashSHA256, Hash: in.SHA256, StorageKey: &key, Reason: in.Reason, OperatorID: in.OperatorID}); err != nil {
		return err
	}
	content := StoredContent{Name: file.Name, Size: in.Size, HashAlgorithm: upload.HashSHA256, Hash: in.SHA256, SHA256: in.SHA256, InspectionID: in.InspectionID, StorageKey: key}
	if err := s.repo.ReplaceStoredContent(ctx, file.ID, content); err != nil {
		return err
	}
	changes, fields := composedChanges(resource, in.PatchVersion, in.Extras)
	if err := s.repo.UpdateResource(ctx, resource.ID, changes); err != nil {
		return err
	}
	if err := s.repo.TouchResource(ctx, resource.ID, s.now()); err != nil {
		return err
	}
	if err := s.activities.Record(ctx, fileActivity(activity.TypeFileReupload, in.OperatorID, file.GameID, file.ID, FileInObjectStore, CheckOK, &in.Size, &file.Name)); err != nil {
		return err
	}
	if err := c.transfers.names.Apply(ctx, resource.ID); err != nil {
		return err
	}
	renamed, err := s.repo.GetFile(ctx, file.ID)
	if err != nil {
		return err
	}
	data := EventData{Name: renamed.Name, Reason: in.Reason, OldSize: &file.Size, NewSize: &in.Size, Changes: fields}
	if renamed.Name != file.Name {
		data.OldName = file.Name
	}
	if err := s.repo.CreateEvent(ctx, NewEvent{ResourceID: resource.ID, Kind: EventRecomposed, ActorID: &in.OperatorID, Data: data}); err != nil {
		return err
	}
	return s.notifyFavorites(ctx, who, renamed, in.Reason)
}

func (c *ComposedService) retire(ctx context.Context, old, current string, before time.Time) error {
	if old == current {
		return c.files.queue.Enqueue(ctx, PurgeObjects{Keys: []string{old}, Before: before})
	}
	return c.files.PurgeLater(ctx, []string{old})
}
