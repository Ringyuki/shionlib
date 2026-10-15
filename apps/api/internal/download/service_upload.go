package download

import (
	"context"
	"time"
)

type UploadDeps struct {
	Store   UploadStore
	Holds   UploadHolds
	Uploads UploadTerminator
	Now     func() time.Time
}

type UploadService struct {
	store   UploadStore
	holds   UploadHolds
	uploads UploadTerminator
	now     func() time.Time
}

func NewUploadService(deps UploadDeps) *UploadService {
	return &UploadService{store: deps.Store, holds: deps.Holds, uploads: deps.Uploads, now: deps.Now}
}

func (s *UploadService) List(ctx context.Context, filter UploadFilter, page Page) ([]Upload, int, error) {
	filter.Now = s.now()
	uploads, total, err := s.store.Uploads(ctx, filter, page)
	if err != nil {
		return nil, 0, err
	}
	for i := range uploads {
		uploads[i].Stage = StageOfUpload(uploads[i].Session, uploads[i].Target, filter.Now)
	}
	return uploads, total, nil
}

func (s *UploadService) Session(ctx context.Context, id int) (UploadDetail, error) {
	detail, err := s.store.SessionUpload(ctx, id)
	if err != nil {
		return UploadDetail{}, err
	}
	detail.Stage = StageOfUpload(detail.Session, detail.Target, s.now())
	if detail.Stage != UploadUploading && detail.Stage != UploadPending {
		return detail, nil
	}
	holders, err := s.holds.Holders(ctx, []int{id})
	if err != nil {
		return UploadDetail{}, err
	}
	detail.Held = holders[id] != ""
	return detail, nil
}

func (s *UploadService) Attempt(ctx context.Context, id int) (UploadDetail, error) {
	detail, err := s.store.AttemptUpload(ctx, id)
	if err != nil {
		return UploadDetail{}, err
	}
	detail.Stage = UploadNotStarted
	return detail, nil
}

func (s *UploadService) Terminate(ctx context.Context, id int) error {
	return s.uploads.Terminate(ctx, id)
}
