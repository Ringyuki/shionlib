package download

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"path"
	"regexp"
	"strconv"
	"time"

	"golang.org/x/text/unicode/norm"

	"github.com/Ringyuki/shionlib/apps/api/internal/activity"
	"github.com/Ringyuki/shionlib/apps/api/internal/message"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

const cleanupBatch = 200

var unsafeKeyCharacters = regexp.MustCompile(`[^\p{L}\p{N}._-]+`)

type Transfers struct {
	repo       Repository
	store      ObjectStore
	local      LocalFiles
	quota      Quota
	activities Activities
	messages   Messenger
	tx         Transactor
	now        func() time.Time
}

func NewTransfers(repo Repository, store ObjectStore, local LocalFiles, quota Quota, activities Activities, messages Messenger, tx Transactor, now func() time.Time) *Transfers {
	return &Transfers{repo: repo, store: store, local: local, quota: quota, activities: activities, messages: messages, tx: tx, now: now}
}

func StorageKey(gameID, fileID int, fileName string) string {
	safe := unsafeKeyCharacters.ReplaceAllString(norm.NFKC.String(path.Base(fileName)), "_")
	return "games/" + strconv.Itoa(gameID) + "/" + strconv.Itoa(fileID) + "/" + safe
}

func (t *Transfers) Store(ctx context.Context, fileID int) error {
	file, err := t.repo.GetFile(ctx, fileID)
	if errors.Is(err, ErrFileNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	if file.Status == FileInObjectStore && file.StorageKey != nil {
		return nil
	}
	if file.CheckStatus != CheckOK {
		return fmt.Errorf("file %d check status %d: %w", file.ID, file.CheckStatus, ErrFileNotReadyForStore)
	}
	if file.Path == nil {
		return fmt.Errorf("file %d: %w", file.ID, ErrLocalFileMissing)
	}
	localPath := *file.Path
	present, err := t.local.Exists(ctx, localPath)
	if err != nil {
		return err
	}
	if !present {
		return fmt.Errorf("file %d at %s: %w", file.ID, localPath, ErrLocalFileMissing)
	}
	key := StorageKey(file.GameID, file.ID, file.Name)
	contentType := upload.DefaultMimeType
	if file.ContentType != nil && *file.ContentType != "" {
		contentType = *file.ContentType
	}
	if err := t.store.Put(ctx, Object{Key: key, LocalPath: localPath, ContentType: contentType, Metadata: objectMetadata(file)}); err != nil {
		return err
	}
	stored := false
	err = t.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		current, err := t.repo.LockFile(ctx, file.ID)
		if errors.Is(err, ErrFileNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		if current.Status != FileOnServer || current.CheckStatus != CheckOK || current.Path == nil || *current.Path != localPath {
			return nil
		}
		if err := t.recordHistory(ctx, current, key); err != nil {
			return err
		}
		if err := t.repo.MarkFileStored(ctx, current.ID, key); err != nil {
			return err
		}
		if err := t.activities.Record(ctx, fileActivity(activity.TypeFileUploadToS3, current.CreatorID, current.GameID, current.ID, FileInObjectStore, CheckOK, nil, nil)); err != nil {
			return err
		}
		meta, err := json.Marshal(map[string]any{"file_id": current.ID, "file_name": current.Name, "file_size": current.Size})
		if err != nil {
			return err
		}
		gameID := current.GameID
		if err := t.messages.Send(ctx, message.NewMessage{
			Type:       message.TypeSystem,
			Tone:       message.ToneSuccess,
			Title:      "Messages.System.File.Upload.FileUploadSuccessTitle",
			Content:    "Messages.System.File.Upload.FileUploadSuccessContent",
			GameID:     &gameID,
			Meta:       meta,
			ReceiverID: current.CreatorID,
		}); err != nil {
			return err
		}
		stored = true
		return t.repo.ResetMalwareStrikes(ctx, current.CreatorID)
	})
	if err != nil || !stored {
		return err
	}
	_ = t.local.Remove(ctx, localPath)
	return nil
}

func (t *Transfers) recordHistory(ctx context.Context, file File, key string) error {
	latest, found, err := t.repo.LatestHistory(ctx, file.ID)
	if err != nil {
		return err
	}
	if found {
		return t.repo.SetHistoryStorageKey(ctx, latest.ID, key)
	}
	return t.repo.CreateHistory(ctx, NewHistory{
		FileID:          file.ID,
		Size:            file.Size,
		HashAlgorithm:   file.HashAlgorithm,
		Hash:            file.Hash,
		StorageKey:      &key,
		UploadSessionID: file.UploadSessionID,
		OperatorID:      file.CreatorID,
	})
}

func objectMetadata(file File) map[string]string {
	metadata := map[string]string{}
	if file.GameID > 0 {
		metadata["game-id"] = strconv.Itoa(file.GameID)
	}
	if file.CreatorID > 0 {
		metadata["uploader-id"] = strconv.Itoa(file.CreatorID)
	}
	if file.Hash != "" {
		metadata["file-sha256"] = file.Hash
	}
	return metadata
}

func (t *Transfers) Purge(ctx context.Context, job PurgeObjects) error {
	var errs []error
	for _, key := range job.Keys {
		if err := t.store.DeleteVersionsBefore(ctx, key, job.Before); err != nil {
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}

func (t *Transfers) CleanFiles(ctx context.Context) error {
	var errs []error
	stored, err := t.repo.ListStoredWithLocalCopy(ctx, cleanupBatch)
	if err != nil {
		return err
	}
	for _, file := range stored {
		if file.Path == nil || !t.local.Owns(*file.Path) {
			continue
		}
		if err := t.local.Remove(ctx, *file.Path); err != nil {
			errs = append(errs, err)
			continue
		}
		if err := t.repo.ClearFilePath(ctx, file.ID); err != nil {
			errs = append(errs, err)
		}
	}
	rejected, err := t.repo.ListRejected(ctx, cleanupBatch)
	if err != nil {
		return errors.Join(append(errs, err)...)
	}
	for _, file := range rejected {
		if err := t.discardRejected(ctx, file.ID); err != nil {
			errs = append(errs, fmt.Errorf("discard rejected file %d: %w", file.ID, err))
		}
	}
	return errors.Join(errs...)
}

func (t *Transfers) discardRejected(ctx context.Context, fileID int) error {
	var localPath *string
	err := t.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		file, err := t.repo.LockFile(ctx, fileID)
		if errors.Is(err, ErrFileNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		if file.Type != FileTypeObjectStore || file.Status != FileOnServer || !file.CheckStatus.Rejected() {
			return nil
		}
		if file.UploadSessionID != nil {
			if err := t.quota.Withdraw(ctx, file.CreatorID, *file.UploadSessionID); err != nil {
				return err
			}
		}
		if err := t.repo.DeleteFile(ctx, file.ID); err != nil {
			return err
		}
		localPath = file.Path
		return removeEmptyResource(ctx, t.repo, file.ResourceID)
	})
	if err != nil {
		return err
	}
	if localPath != nil && t.local.Owns(*localPath) {
		return t.local.Remove(ctx, *localPath)
	}
	return nil
}
