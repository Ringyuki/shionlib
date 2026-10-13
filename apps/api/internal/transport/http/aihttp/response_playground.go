package aihttp

import "github.com/Ringyuki/shionlib/apps/api/internal/ai"

type aiPlaygroundResultDTO struct {
	OK       bool           `json:"ok"`
	Output   *string        `json:"output"`
	Error    *aiFailureDTO  `json:"error"`
	Attempts []aiRequestDTO `json:"attempts"`
}

type aiPlaygroundDTO struct {
	Results []aiPlaygroundResultDTO `json:"results"`
}

func toPlaygroundDTO(results []ai.PlaygroundResult) aiPlaygroundDTO {
	dto := aiPlaygroundDTO{Results: make([]aiPlaygroundResultDTO, len(results))}
	for i, result := range results {
		dto.Results[i] = aiPlaygroundResultDTO{OK: result.OK, Output: result.Output, Error: toFailureDTO(result.Failure), Attempts: toRequestDTOs(result.Attempts)}
	}
	return dto
}
