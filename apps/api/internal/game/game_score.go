package game

import (
	"slices"
	"time"
)

const ScoreCacheTTL = 7 * 24 * time.Hour

var BangumiResourceKinds = []string{"subjects", "characters", "persons", "episodes", "indices"}

var BangumiResourceRelations = []string{"subjects", "characters", "persons"}

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
