package gamepg_test

import (
	"slices"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/gamepg"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

func TestReferencedFindsGamesByTheirExternalIDs(t *testing.T) {
	f := newFixtures(t)
	repo := gamepg.NewRepository(f.db.Ent)
	first := f.game(func(c *ent.GameCreate) { c.SetVID("v17").SetBID("42").SetHID(9) })
	second := f.game(func(c *ent.GameCreate) { c.SetVID("v17") })
	f.game(func(c *ent.GameCreate) { c.SetVID("v170").SetBID("420").SetHID(90) })

	for _, tc := range []struct {
		reference game.Reference
		want      []int
	}{
		{game.Reference{Source: game.ReferenceVNDB, Number: 17}, []int{first, second}},
		{game.Reference{Source: game.ReferenceBangumi, Number: 42}, []int{first}},
		{game.Reference{Source: game.ReferenceHikarinagi, Number: 9}, []int{first}},
		{game.Reference{Source: game.ReferenceHikarinagi, Number: 8}, []int{}},
	} {
		ids, err := repo.Referenced(f.ctx, tc.reference)
		if err != nil || !slices.Equal(ids, tc.want) {
			t.Fatalf("%+v: got %v %v, want %v", tc.reference, ids, err, tc.want)
		}
	}
}
