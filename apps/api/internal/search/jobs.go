package search

type RecordSearchJob struct {
	Query string `json:"query"`
}

func (RecordSearchJob) Kind() string {
	return "search_analytics"
}
