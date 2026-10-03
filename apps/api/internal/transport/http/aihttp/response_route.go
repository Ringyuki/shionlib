package aihttp

type aiCheckDTO struct {
	OK    bool          `json:"ok"`
	Error *aiFailureDTO `json:"error"`
	Route aiRouteDTO    `json:"route"`
}

type aiBatchDTO struct {
	Count int `json:"count"`
}
