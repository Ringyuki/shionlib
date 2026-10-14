package friendlinkpg

import (
	"context"
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entfriendlink "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/friendlink"
	"github.com/Ringyuki/shionlib/apps/api/internal/friendlink"
)

type Repository struct {
	client *ent.Client
}

func NewRepository(client *ent.Client) *Repository {
	return &Repository{client: client}
}

func (r *Repository) db(ctx context.Context) *ent.Client {
	return postgres.Client(ctx, r.client)
}

func (r *Repository) List(ctx context.Context, visibleOnly bool) ([]friendlink.Link, error) {
	query := r.db(ctx).FriendLink.Query()
	if visibleOnly {
		query.Where(entfriendlink.Visible(true))
	}
	rows, err := query.Order(ent.Asc(entfriendlink.FieldPosition), ent.Asc(entfriendlink.FieldID)).All(ctx)
	if err != nil {
		return nil, fmt.Errorf("list friend links: %w", err)
	}
	return toLinks(rows), nil
}

func (r *Repository) Get(ctx context.Context, id int) (friendlink.Link, error) {
	row, err := r.db(ctx).FriendLink.Get(ctx, id)
	if postgres.IsNotFound(err) {
		return friendlink.Link{}, friendlink.ErrNotFound
	}
	if err != nil {
		return friendlink.Link{}, fmt.Errorf("get friend link %d: %w", id, err)
	}
	return toLink(row), nil
}

func (r *Repository) Create(ctx context.Context, in friendlink.NewLink, position int) (friendlink.Link, error) {
	row, err := r.db(ctx).FriendLink.Create().
		SetName(in.Name).
		SetURL(in.URL).
		SetNillableLogo(in.Logo).
		SetDescription(in.Description).
		SetVisible(in.Visible).
		SetPosition(position).
		Save(ctx)
	if err != nil {
		return friendlink.Link{}, fmt.Errorf("create friend link: %w", err)
	}
	return toLink(row), nil
}

func (r *Repository) Update(ctx context.Context, id int, changes friendlink.Changes) (friendlink.Link, error) {
	update := r.db(ctx).FriendLink.UpdateOneID(id).
		SetNillableName(changes.Name).
		SetNillableURL(changes.URL).
		SetNillableDescription(changes.Description).
		SetNillableVisible(changes.Visible)
	if changes.Logo.Set {
		if changes.Logo.Value == nil {
			update.ClearLogo()
		} else {
			update.SetLogo(*changes.Logo.Value)
		}
	}
	row, err := update.Save(ctx)
	if postgres.IsNotFound(err) {
		return friendlink.Link{}, friendlink.ErrNotFound
	}
	if err != nil {
		return friendlink.Link{}, fmt.Errorf("update friend link %d: %w", id, err)
	}
	return toLink(row), nil
}

func (r *Repository) Delete(ctx context.Context, id int) error {
	err := r.db(ctx).FriendLink.DeleteOneID(id).Exec(ctx)
	if postgres.IsNotFound(err) {
		return friendlink.ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("delete friend link %d: %w", id, err)
	}
	return nil
}

func (r *Repository) LastPosition(ctx context.Context) (int, error) {
	row, err := r.db(ctx).FriendLink.Query().Order(ent.Desc(entfriendlink.FieldPosition)).First(ctx)
	if postgres.IsNotFound(err) {
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("find the last friend link: %w", err)
	}
	return row.Position, nil
}

func (r *Repository) SetPosition(ctx context.Context, id, position int) error {
	err := r.db(ctx).FriendLink.UpdateOneID(id).SetPosition(position).Exec(ctx)
	if postgres.IsNotFound(err) {
		return friendlink.ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("move friend link %d: %w", id, err)
	}
	return nil
}
