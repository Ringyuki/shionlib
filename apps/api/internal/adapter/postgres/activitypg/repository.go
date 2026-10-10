package activitypg

import (
	"context"
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/activity"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entactivity "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/activity"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/comment"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedownloadresourcefile"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/predicate"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/walkthrough"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/gamepg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/userpg"
	commentmodel "github.com/Ringyuki/shionlib/apps/api/internal/comment"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

type Repository struct {
	client *ent.Client
}

func NewRepository(client *ent.Client) *Repository {
	return &Repository{client: client}
}

func (r *Repository) Create(ctx context.Context, in activity.NewActivity) error {
	err := postgres.Client(ctx, r.client).Activity.Create().
		SetType(entactivity.Type(in.Type)).
		SetUserID(in.UserID).
		SetNillableGameID(in.GameID).
		SetNillableWalkthroughID(in.WalkthroughID).
		SetNillableEditRecordID(in.EditRecordID).
		SetNillableCommentID(in.CommentID).
		SetNillableDeveloperID(in.DeveloperID).
		SetNillableCharacterID(in.CharacterID).
		SetNillableFileID(in.FileID).
		SetNillableFileStatus(in.FileStatus).
		SetNillableFileCheckStatus(in.FileCheckStatus).
		SetNillableFileSize(in.FileSize).
		SetNillableFileName(in.FileName).
		Exec(ctx)
	if err != nil {
		return fmt.Errorf("record activity %s: %w", in.Type, err)
	}
	return nil
}

func (r *Repository) List(ctx context.Context, filter activity.Filter, page activity.Page) ([]activity.Entry, int, error) {
	types := make([]entactivity.Type, len(filter.Types))
	for i, kind := range filter.Types {
		types[i] = entactivity.Type(kind)
	}
	query := postgres.Client(ctx, r.client).Activity.Query().Where(
		entactivity.TypeIn(types...),
		entactivity.HasGameWith(gamepg.ListablePredicates(game.Visibility{ExcludeRated: filter.ExcludeRated})...),
		stillPublic(),
	)
	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("count activities: %w", err)
	}
	rows, err := query.
		WithUser(userpg.SelectSummary).
		WithWalkthrough(func(q *ent.WalkthroughQuery) { q.Select(walkthrough.FieldID, walkthrough.FieldTitle) }).
		WithComment(func(q *ent.CommentQuery) { q.Select(comment.FieldID, comment.FieldText) }).
		WithFile(func(q *ent.GameDownloadResourceFileQuery) {
			q.Select(gamedownloadresourcefile.FieldID, gamedownloadresourcefile.FieldGameDownloadResourceID, gamedownloadresourcefile.FieldFileName, gamedownloadresourcefile.FieldFileSize)
		}).
		Order(ent.Desc(entactivity.FieldCreated), ent.Desc(entactivity.FieldID)).
		Offset(page.Offset()).
		Limit(page.Size).
		All(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("list activities: %w", err)
	}
	entries := make([]activity.Entry, len(rows))
	for i, row := range rows {
		entries[i] = toEntry(row)
	}
	return entries, total, nil
}

func stillPublic() predicate.Activity {
	return entactivity.Or(
		entactivity.And(
			entactivity.TypeEQ(entactivity.TypeFILE_UPLOAD_TO_S3),
			entactivity.HasFileWith(gamepg.PublicFile(), gamedownloadresourcefile.HasGameDownloadResourceWith(gamepg.PublicResource())),
		),
		entactivity.And(
			entactivity.TypeEQ(entactivity.TypeCOMMENT),
			entactivity.HasCommentWith(comment.Status(int(commentmodel.StatusVisible))),
		),
		entactivity.And(
			entactivity.TypeEQ(entactivity.TypeWALKTHROUGH_CREATE),
			entactivity.HasWalkthroughWith(walkthrough.StatusEQ(walkthrough.StatusPUBLISHED)),
		),
	)
}
