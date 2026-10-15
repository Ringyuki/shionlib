package walkthroughhttp

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/richtext"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/richtexthttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

type walkthroughFormatterDTO struct {
	Available bool `json:"available" doc:"True when a model formats walkthroughs and the daily quota is above zero"`
}

type walkthroughFormattedDTO struct {
	_      struct{}              `nullable:"true"`
	Note   richtexthttp.Content  `json:"note,omitempty" doc:"What belongs to no route; left out when there is none"`
	Routes []walkthroughRouteDTO `json:"routes" doc:"In the order of the text; a route about characters only has no name"`
}

type walkthroughFormatTaskDTO struct {
	ID     string                   `json:"id"`
	State  string                   `json:"state" enum:"working,done"`
	Result *walkthroughFormattedDTO `json:"result" doc:"The note and routes once the task is done; null while it works"`
}

func toFormatTask(task walkthrough.FormatTask) (walkthroughFormatTaskDTO, error) {
	dto := walkthroughFormatTaskDTO{ID: task.ID, State: string(task.State)}
	if task.State != walkthrough.FormatDone {
		return dto, nil
	}
	note, err := richtext.Paragraphs(task.Result.Note)
	if err != nil {
		return walkthroughFormatTaskDTO{}, err
	}
	dto.Result = &walkthroughFormattedDTO{Note: richtexthttp.Content(note.Raw()), Routes: toRoutes(task.Result.Routes)}
	return dto, nil
}
