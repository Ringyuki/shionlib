package search

type IndexJob struct {
	GameIDs []int `json:"game_ids"`
}

func (IndexJob) Kind() string {
	return IndexJobKind
}

type RecordSearchJob struct {
	Query string `json:"query"`
}

func (RecordSearchJob) Kind() string {
	return "search_analytics"
}
