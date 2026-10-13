package inspectionpg_test

import (
	"context"
	"strconv"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/inspectionpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/inspection/inspectiontest"
)

func TestRepositoryContract(t *testing.T) {
	inspectiontest.RepositoryContract(t, func(t *testing.T) inspectiontest.Env {
		db := pgtest.New(t)
		ctx := context.Background()
		return inspectiontest.Env{
			Repo: inspectionpg.NewRepository(db.Ent),
			NewResource: func(t *testing.T) int {
				return db.Ent.GameDownloadResource.Create().SetGameID(db.Game(t)).SetCreatorID(db.User(t)).SaveX(ctx).ID
			},
			Attach: func(t *testing.T, inspectionID int) {
				resource := db.Ent.Inspection.GetX(ctx, inspectionID).ResourceID
				db.Ent.GameDownloadResourceFile.Create().
					SetGameDownloadResourceID(resource).
					SetType(download.FileTypeObjectStore).
					SetFileName("game-" + strconv.Itoa(inspectionID) + ".7z").
					SetFileSize(1).
					SetFileHash("hash").
					SetFileStatus(download.FileInObjectStore).
					SetCreatorID(db.User(t)).
					SetInspectionID(inspectionID).
					SaveX(ctx)
			},
		}
	})
}
