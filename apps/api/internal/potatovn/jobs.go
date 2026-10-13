package potatovn

type SyncLibraryJob struct {
	UserID int `json:"user_id"`
}

func (SyncLibraryJob) Kind() string {
	return "potatovn_sync_library"
}
