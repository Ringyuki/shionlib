package catalog

type ImportJob struct {
	Source     string `json:"source"`
	Entity     Entity `json:"entity"`
	ExternalID string `json:"external_id"`
}

func (ImportJob) Kind() string {
	return "catalog_import"
}

func (ImportJob) Queue() string {
	return ImportQueue
}

func (ImportJob) MaxAttempts() int {
	return importMaxAttempts
}

func (ImportJob) UniqueByArgs() bool {
	return true
}
