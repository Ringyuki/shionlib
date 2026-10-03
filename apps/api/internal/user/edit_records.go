package user

import (
	"context"
	"encoding/json"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
)

const (
	EditedGameEntity      = "game"
	EditedCharacterEntity = "character"
	EditedDeveloperEntity = "developer"
)

type EditRecord struct {
	ID           int
	Entity       string
	TargetID     int
	Action       string
	FieldChanges []string
	Changes      json.RawMessage
	RelationType *string
	Created      time.Time
	Updated      time.Time
	Game         *EditedGame
	Character    *EditedCharacter
	Developer    *EditedDeveloper
}

type EditedGame struct {
	ID      int
	TitleJP string
	TitleZH string
	TitleEN string
	IntroJP string
	IntroZH string
	IntroEN string
	Covers  []EditedCover
}

type EditedCover struct {
	URL      string
	Language string
	Dims     []int
	Sexual   int
	Violence int
}

type EditedCharacter struct {
	ID     int
	NameJP string
	NameZH *string
	NameEN *string
}

type EditedDeveloper struct {
	ID      int
	Name    string
	Aliases []string
}

type EditHistory struct {
	store EditRecordStore
}

func NewEditHistory(store EditRecordStore) *EditHistory {
	return &EditHistory{store: store}
}

func (h *EditHistory) List(ctx context.Context, viewer actor.Actor, userID int, page Page) ([]EditRecord, int, error) {
	return h.store.ListByActor(ctx, userID, viewer, page)
}
