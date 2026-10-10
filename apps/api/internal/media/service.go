package media

import (
	"context"
	"fmt"

	"github.com/google/uuid"
)

type Service struct {
	processor Transcoder
	store     Store
	newID     func() string
}

func NewService(processor Transcoder, store Store, newID func() string) *Service {
	if newID == nil {
		newID = uuid.NewString
	}
	return &Service{processor: processor, store: store, newID: newID}
}

func (s *Service) StoreAvatar(ctx context.Context, userID int, file *Upload) (string, error) {
	return s.saveKey(ctx, avatar(userID), file)
}

func (s *Service) StoreCover(ctx context.Context, userID int, file *Upload) (string, error) {
	return s.saveKey(ctx, cover(userID), file)
}

func (s *Service) StoreAdImage(ctx context.Context, uploaderID int, file *Upload) (string, error) {
	return s.saveKey(ctx, adImage(uploaderID), file)
}

func (s *Service) StoreRichTextImage(ctx context.Context, userID int, file *Upload) (Picture, error) {
	return s.save(ctx, richTextImage(userID), file)
}

func (s *Service) saveKey(ctx context.Context, k kind, file *Upload) (string, error) {
	picture, err := s.save(ctx, k, file)
	return picture.Key, err
}

func (s *Service) save(ctx context.Context, k kind, file *Upload) (Picture, error) {
	if err := Validate(file, k.maxBytes); err != nil {
		return Picture{}, err
	}
	encoded, err := s.processor.ToWebP(ctx, file.Data, k.bounds)
	if err != nil {
		return Picture{}, err
	}
	key := k.key(s.newID() + encoded.Extension)
	if err := s.store.PutBytes(ctx, key, encoded.Data, encoded.ContentType, k.metadata); err != nil {
		return Picture{}, fmt.Errorf("store image %s: %w", key, err)
	}
	return Picture{Key: key, Width: encoded.Width, Height: encoded.Height}, nil
}
