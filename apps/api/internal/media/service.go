package media

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

type Service struct {
	processor Processor
	store     Store
	newID     func() string
}

func NewService(processor Processor, store Store, newID func() string) *Service {
	if newID == nil {
		newID = uuid.NewString
	}
	return &Service{processor: processor, store: store, newID: newID}
}

func (s *Service) StoreAvatar(ctx context.Context, userID int, file *Upload) (string, error) {
	return s.save(ctx, avatar(userID), file)
}

func (s *Service) StoreCover(ctx context.Context, userID int, file *Upload) (string, error) {
	return s.save(ctx, cover(userID), file)
}

func (s *Service) StoreAdImage(ctx context.Context, uploaderID int, file *Upload) (string, error) {
	return s.save(ctx, adImage(uploaderID), file)
}

func Validate(file *Upload, maxBytes int) error {
	if file == nil || len(file.Data) == 0 {
		return upload.ErrSmallFileMissing
	}
	if !Accepts(file.ContentType) {
		return upload.ErrSmallFileUnsupported
	}
	if len(file.Data) > maxBytes {
		return upload.ErrSmallFileTooLarge
	}
	return nil
}

func (s *Service) save(ctx context.Context, k kind, file *Upload) (string, error) {
	if err := Validate(file, k.maxBytes); err != nil {
		return "", err
	}
	encoded, err := s.processor.ToWebP(ctx, file.Data, k.bounds)
	if err != nil {
		return "", err
	}
	key := k.key(s.newID() + encoded.Extension)
	if err := s.store.PutBytes(ctx, key, encoded.Data, encoded.ContentType, k.metadata); err != nil {
		return "", fmt.Errorf("store image %s: %w", key, err)
	}
	return key, nil
}
