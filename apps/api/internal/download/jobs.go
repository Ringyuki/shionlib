package download

import "time"

const (
	TransferQueue       = "file_transfer"
	TransferConcurrency = 2
	transferAttempts    = 5
	purgeAttempts       = 10
)

type StoreFile struct {
	FileID int `json:"file_id"`
}

func (StoreFile) Kind() string {
	return "download_store_file"
}

func (StoreFile) Queue() string {
	return TransferQueue
}

func (StoreFile) MaxAttempts() int {
	return transferAttempts
}

type PurgeObjects struct {
	Keys   []string  `json:"keys"`
	Before time.Time `json:"before"`
}

func (PurgeObjects) Kind() string {
	return "download_purge_objects"
}

func (PurgeObjects) MaxAttempts() int {
	return purgeAttempts
}
