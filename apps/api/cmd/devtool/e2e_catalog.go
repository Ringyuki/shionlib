package main

import (
	"context"
	"fmt"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
)

const (
	e2eCatalogCursor       = "135875"
	e2eCatalogChanges      = 14
	e2eExcludedExternalID  = "21004"
	e2eExcludedLocalID     = 21004
	e2eExcludedTitle       = "テスト用エントリ"
	e2eExcludedFor         = 9 * 24 * time.Hour
	e2eCatalogPulledBefore = time.Hour
	e2eGameShown           = 1
)

func (s *e2eSeeder) seedCatalogSync(ctx context.Context, tx *ent.Client, adminID int) error {
	now := s.now().UTC()
	err := tx.CatalogSyncCursor.Create().
		SetSource(e2eHikarinagiSource).
		SetCursor(e2eCatalogCursor).
		SetPulledAt(now.Add(-e2eCatalogPulledBefore)).
		SetChanges(e2eCatalogChanges).
		Exec(ctx)
	if err != nil {
		return fmt.Errorf("seed catalog sync state: %w", err)
	}
	err = tx.CatalogSourceLink.Create().
		SetSource(e2eHikarinagiSource).
		SetEntity(e2eCatalogEntityGame).
		SetExternalID(e2eExcludedExternalID).
		SetLocalID(e2eExcludedLocalID).
		SetTitle(e2eExcludedTitle).
		SetExcludedAt(now.Add(-e2eExcludedFor)).
		SetExcludedBy(adminID).
		Exec(ctx)
	if err != nil {
		return fmt.Errorf("seed excluded catalog entry: %w", err)
	}
	return nil
}
