package authtest

import (
	"testing"
	"time"
)

func TestMemoryStoreContract(t *testing.T) {
	StoreContract(t, func(*testing.T) Store {
		return NewMemoryStore(time.Now)
	})
}
