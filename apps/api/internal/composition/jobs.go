package composition

const (
	RunQueue       = "composition"
	MaxConcurrency = 4
	runAttempts    = 5
	readAttempts   = 5
)

type Read struct {
	CompositionID int  `json:"composition_id"`
	Role          Role `json:"role"`
}

func (Read) Kind() string {
	return "composition_read_input"
}

func (Read) MaxAttempts() int {
	return readAttempts
}

func (Read) UniqueByArgs() bool {
	return true
}

type Run struct {
	CompositionID int `json:"composition_id"`
}

func (Run) Kind() string {
	return "composition_run"
}

func (Run) Queue() string {
	return RunQueue
}

func (Run) MaxAttempts() int {
	return runAttempts
}

func (Run) UniqueByArgs() bool {
	return true
}
