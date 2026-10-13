package messagepg_test

import (
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/messagepg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/message/messagetest"
)

func TestRepositoryContract(t *testing.T) {
	messagetest.RepositoryContract(t, func(t *testing.T) messagetest.Env {
		db := pgtest.New(t)
		return messagetest.Env{
			Repo:    messagepg.NewRepository(db.Ent),
			NewUser: db.User,
			NewGame: func(t *testing.T) int { return db.Game(t) },
		}
	})
}
