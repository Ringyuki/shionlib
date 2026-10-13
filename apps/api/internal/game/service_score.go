package game

import (
	"context"

	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
)

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
