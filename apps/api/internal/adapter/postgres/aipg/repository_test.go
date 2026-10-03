package aipg_test

import (
	"strings"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
	"github.com/Ringyuki/shionlib/apps/api/internal/ai/aitest"
)

func TestRepositoryContract(t *testing.T) {
	aitest.RepositoryContract(t, func(t *testing.T) aitest.RepositoryEnv {
		_, env := repositoryEnv(t)
		return env
	})
}

func TestProviderKeysAreSealedAtRest(t *testing.T) {
	db, env := repositoryEnv(t)
	id, err := env.Repo.CreateProvider(t.Context(), ai.NewProvider{Name: "sealed", Kind: ai.KindOpenAI, APIKey: "sk-plaintext-secret-value", PriceMultiplier: 1})
	if err != nil {
		t.Fatal(err)
	}
	row, err := db.Ent.AIProvider.Get(t.Context(), id)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(row.APIKey, "plaintext") || !strings.HasPrefix(row.APIKey, "v1:") || row.KeyHint != "sk-…alue" {
		t.Fatalf("stored key %q hint %q", row.APIKey, row.KeyHint)
	}
	connection, err := env.Repo.ProviderConnection(t.Context(), id)
	if err != nil || connection.APIKey != "sk-plaintext-secret-value" {
		t.Fatalf("connection %+v %v", connection, err)
	}
}
