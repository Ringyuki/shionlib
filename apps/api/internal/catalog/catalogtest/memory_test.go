package catalogtest_test

import (
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/catalog/catalogtest"
)

func TestMemoryStoreContract(t *testing.T) {
	catalogtest.StoreContract(t, func(*testing.T) catalogtest.Env {
		return catalogtest.Env{Store: catalogtest.NewStore(), CreatorID: func(*testing.T) int { return 1 }}
	})
}
