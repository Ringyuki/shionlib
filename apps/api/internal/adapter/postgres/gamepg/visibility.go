package gamepg

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	entgame "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamecover"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/predicate"
)

func SafeForStrictViewers() predicate.Game {
	return entgame.And(entgame.Nsfw(false), entgame.Not(entgame.HasCoversWith(gamecover.SexualGT(0))))
}

func VisibleTo(viewer actor.Actor) []predicate.Game {
	if viewer.IncludesRated() {
		return nil
	}
	return []predicate.Game{SafeForStrictViewers()}
}
