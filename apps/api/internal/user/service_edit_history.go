package user

import (
	"context"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
)

type EditHistoryService struct {
	store EditRecordStore
}

func NewEditHistoryService(store EditRecordStore) *EditHistoryService {
	return &EditHistoryService{store: store}
}

func (h *EditHistoryService) List(ctx context.Context, viewer actor.Actor, userID int, page Page) ([]EditRecord, int, error) {
	return h.store.ListByActor(ctx, userID, viewer, page)
}
