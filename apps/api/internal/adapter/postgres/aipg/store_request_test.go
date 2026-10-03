package aipg_test

import (
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/aipg"
	"github.com/Ringyuki/shionlib/apps/api/internal/ai/aitest"
)

func TestRequestLogContract(t *testing.T) {
	aitest.RequestLogContract(t, func(t *testing.T) aitest.RequestLogEnv {
		db, env := repositoryEnv(t)
		return aitest.RequestLogEnv{Log: aipg.NewRequestStore(db.Ent), Repo: env.Repo}
	})
}
