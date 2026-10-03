package activity

import (
	"slices"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/paging"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

type Type string

const (
	TypeComment                      Type = "COMMENT"
	TypeFileUploadToServer           Type = "FILE_UPLOAD_TO_SERVER"
	TypeFileUploadToS3               Type = "FILE_UPLOAD_TO_S3"
	TypeFileReupload                 Type = "FILE_REUPLOAD"
	TypeFileCheckOK                  Type = "FILE_CHECK_OK"
	TypeFileCheckBrokenOrTruncated   Type = "FILE_CHECK_BROKEN_OR_TRUNCATED"
	TypeFileCheckBrokenOrUnsupported Type = "FILE_CHECK_BROKEN_OR_UNSUPPORTED"
	TypeFileCheckEncrypted           Type = "FILE_CHECK_ENCRYPTED"
	TypeFileCheckHarmful             Type = "FILE_CHECK_HARMFUL"
	TypeGameCreate                   Type = "GAME_CREATE"
	TypeWalkthroughCreate            Type = "WALKTHROUGH_CREATE"
	TypeGameEdit                     Type = "GAME_EDIT"
	TypeDeveloperEdit                Type = "DEVELOPER_EDIT"
	TypeCharacterEdit                Type = "CHARACTER_EDIT"
)

type Category string

const (
	CategoryComments           Category = "comments"
	CategoryGameCreates        Category = "gameCreates"
	CategoryWalkthroughCreates Category = "walkthroughCreates"
	CategoryEdits              Category = "edits"
	CategoryFiles              Category = "files"
)

var categoryTypes = map[Category][]Type{
	CategoryComments:           {TypeComment},
	CategoryGameCreates:        {TypeGameCreate},
	CategoryWalkthroughCreates: {TypeWalkthroughCreate},
	CategoryEdits:              {TypeGameEdit, TypeDeveloperEdit, TypeCharacterEdit},
	CategoryFiles: {
		TypeFileUploadToServer, TypeFileUploadToS3, TypeFileReupload, TypeFileCheckOK,
		TypeFileCheckBrokenOrTruncated, TypeFileCheckBrokenOrUnsupported, TypeFileCheckEncrypted, TypeFileCheckHarmful,
	},
}

func (c Category) Types() []Type {
	return slices.Clone(categoryTypes[c])
}

func (c Category) Valid() bool {
	_, ok := categoryTypes[c]
	return ok
}

const (
	FileStatusPending          = 1
	FileStatusUploadedToServer = 2
	FileStatusUploadedToS3     = 3
)

type NewActivity struct {
	Type            Type
	UserID          int
	GameID          *int
	WalkthroughID   *int
	EditRecordID    *int
	CommentID       *int
	DeveloperID     *int
	CharacterID     *int
	FileID          *int
	FileStatus      *int
	FileCheckStatus *int
	FileSize        *int64
	FileName        *string
}

type WalkthroughRef struct {
	ID    int
	Title string
}

type CommentRef struct {
	ID   int
	HTML *string
}

type DeveloperRef struct {
	ID   int
	Name string
}

type CharacterRef struct {
	ID     int
	NameJP string
	NameZH *string
	NameEN *string
}

type FileRef struct {
	ID              int
	FileName        string
	FileSize        int64
	FileStatus      *int
	FileCheckStatus *int
}

type Entry struct {
	ID          int
	Type        Type
	User        user.Summary
	GameID      *int
	Game        *game.Card
	Walkthrough *WalkthroughRef
	Comment     *CommentRef
	Developer   *DeveloperRef
	Character   *CharacterRef
	File        *FileRef
	Created     time.Time
	Updated     time.Time
}

type Filter struct {
	Types        []Type
	ExcludeRated bool
}

type Page = paging.Page
