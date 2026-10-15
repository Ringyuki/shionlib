package walkthrough

type FormatWalkthrough struct {
	TaskID string `json:"task_id"`
}

func (FormatWalkthrough) Kind() string { return "walkthrough_format" }

func (FormatWalkthrough) Queue() string { return FormatQueue }

func (FormatWalkthrough) MaxAttempts() int { return formatAttempts }
