package game

import (
	"context"
	"slices"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
)

const ScoreCacheTTL = 7 * 24 * time.Hour

var (
	BangumiResourceKinds     = []string{"subjects", "characters", "persons", "episodes", "indices"}
	BangumiResourceRelations = []string{"subjects", "characters", "persons"}
)

type BangumiRating struct {
	Rank  int
	Total int
	Count map[string]int
	Score float64
}

type BangumiScore struct {
	ID     int
	Rating BangumiRating
}

type VNDBScore struct {
	ID        string
	Rating    *float64
	Average   *float64
	VoteCount int
}

type BangumiResourceQuery struct {
	Kind     string
	ID       string
	Relation string
}

func (q BangumiResourceQuery) path() (string, bool) {
	if !slices.Contains(BangumiResourceKinds, q.Kind) || !digitsOnly(q.ID) {
		return "", false
	}
	path := q.Kind + "/" + q.ID
	if q.Relation == "" {
		return path, true
	}
	if !slices.Contains(BangumiResourceRelations, q.Relation) {
		return "", false
	}
	return path + "/" + q.Relation, true
}

func digitsOnly(value string) bool {
	if value == "" || len(value) > 20 {
		return false
	}
	for _, r := range value {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

type ScoreService struct {
	games   ExternalIDLookup
	bangumi Bangumi
	vndb    VNDB
	cache   Cache
}

func NewScoreService(games ExternalIDLookup, bangumi Bangumi, vndb VNDB, cache Cache) *ScoreService {
	return &ScoreService{games: games, bangumi: bangumi, vndb: vndb, cache: cache}
}

func (s *ScoreService) Bangumi(ctx context.Context, gameID int) (*BangumiScore, error) {
	ids, err := s.games.ExternalIDs(ctx, gameID)
	if err != nil {
		return nil, err
	}
	if ids.BangumiID == nil || *ids.BangumiID == "" {
		return nil, nil
	}
	key := "game:score:bangumi:" + *ids.BangumiID
	var cached BangumiScore
	if found, err := s.cache.Get(ctx, key, &cached); err == nil && found {
		return &cached, nil
	}
	if !digitsOnly(*ids.BangumiID) {
		return nil, ErrBangumiRequestFailed.New().WithArgs(map[string]any{"message": "invalid subject id"})
	}
	score, err := s.bangumi.Subject(ctx, *ids.BangumiID)
	if err != nil {
		return nil, err
	}
	_ = s.cache.Set(ctx, key, score, ScoreCacheTTL)
	return &score, nil
}

func (s *ScoreService) VNDB(ctx context.Context, gameID int) (*VNDBScore, error) {
	ids, err := s.games.ExternalIDs(ctx, gameID)
	if err != nil {
		return nil, err
	}
	if ids.VNDBID == nil || *ids.VNDBID == "" {
		return nil, nil
	}
	key := "game:score:vndb:" + *ids.VNDBID
	var cached VNDBScore
	if found, err := s.cache.Get(ctx, key, &cached); err == nil && found {
		return &cached, nil
	}
	score, found, err := s.vndb.Rating(ctx, *ids.VNDBID)
	if err != nil || !found {
		return nil, err
	}
	_ = s.cache.Set(ctx, key, score, ScoreCacheTTL)
	return &score, nil
}

func (s *ScoreService) BangumiResource(ctx context.Context, query BangumiResourceQuery) ([]byte, error) {
	path, ok := query.path()
	if !ok {
		return nil, apperror.ErrValidationFailed.New()
	}
	return s.bangumi.Resource(ctx, path)
}
