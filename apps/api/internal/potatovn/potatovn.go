package potatovn

import (
	"cmp"
	"context"
	"slices"
	"strings"
	"time"
)

type ScheduleSync func(ctx context.Context, job SyncLibraryJob) error

const (
	RefreshThreshold        = 3 * 24 * time.Hour
	LibraryPageSize         = 50
	MaxLibraryPages         = 200
	MaxCoverBytes           = 20 << 20
	DefaultCoverContentType = "image/webp"
	SyncScheduleBatch       = 500
	MaxUserNameLength       = 255
)

type Binding struct {
	UserID        int
	PVNUserID     int
	PVNUserName   string
	PVNUserAvatar *string
	Token         string
	TokenExpires  time.Time
	Created       time.Time
	Updated       time.Time
}

type NewBinding struct {
	UserID       int
	PVNUserID    int
	PVNUserName  string
	Token        string
	TokenExpires time.Time
}

type Session struct {
	UserID   int
	UserName string
	Token    string
	Expires  time.Time
}

type PlayData struct {
	TotalPlayTime int
	LastPlayDate  *time.Time
	PlayType      int
	MyRate        int
}

type Mapping struct {
	UserID       int
	GameID       int
	PVNGalgameID int
	PlayData
	SyncedAt time.Time
}

type NewMapping struct {
	UserID       int
	GameID       int
	PVNGalgameID int
	PlayData
	SyncedAt time.Time
}

type PlaySession struct {
	At      time.Time
	Minutes int
}

type Galgame struct {
	ID            int
	BangumiID     *string
	VNDBID        *string
	TotalPlayTime int
	Sessions      []PlaySession
	PlayType      int
	MyRate        int
}

func (g Galgame) PlayData() PlayData {
	data := PlayData{TotalPlayTime: g.TotalPlayTime, PlayType: g.PlayType, MyRate: g.MyRate}
	if len(g.Sessions) > 0 {
		latest := slices.MaxFunc(g.Sessions, func(a, b PlaySession) int { return a.At.Compare(b.At) })
		at := latest.At
		data.LastPlayDate = &at
	}
	return data
}

func (g Galgame) localVNDBID() *string {
	if g.VNDBID == nil || *g.VNDBID == "" {
		return nil
	}
	id := *g.VNDBID
	if !strings.HasPrefix(id, "v") {
		id = "v" + id
	}
	return &id
}

func (g Galgame) localBangumiID() *string {
	if g.BangumiID == nil || *g.BangumiID == "" {
		return nil
	}
	return g.BangumiID
}

type LibraryPage struct {
	Items     []Galgame
	PageCount int
}

type GameInfo struct {
	ID          int
	VNDBID      *string
	BangumiID   *string
	TitleJP     string
	TitleZH     string
	TitleEN     string
	IntroJP     string
	IntroZH     string
	IntroEN     string
	Tags        []string
	ReleaseDate *time.Time
	CoverKey    *string
}

func (g GameInfo) draft() GalgameDraft {
	draft := GalgameDraft{
		BangumiID:   g.BangumiID,
		VNDBID:      g.VNDBID,
		Name:        cmp.Or(g.TitleJP, g.TitleZH, g.TitleEN),
		CnName:      g.TitleZH,
		Description: cmp.Or(g.IntroZH, g.IntroJP, g.IntroEN),
		Tags:        slices.Clone(g.Tags),
	}
	if draft.Tags == nil {
		draft.Tags = []string{}
	}
	if g.ReleaseDate != nil {
		seconds := float64(g.ReleaseDate.UnixMilli()) / 1000
		draft.ReleaseTimestamp = &seconds
	}
	return draft
}

type GalgameDraft struct {
	BangumiID        *string
	VNDBID           *string
	Name             string
	CnName           string
	Description      string
	Tags             []string
	ReleaseTimestamp *float64
	PlayType         int
	ImageLoc         *string
}

type Cover struct {
	Data        []byte
	ContentType string
}
