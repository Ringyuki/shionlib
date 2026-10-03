package download

import (
	"time"
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

func (StoreFile) UniqueByArgs() bool {
	return true
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
