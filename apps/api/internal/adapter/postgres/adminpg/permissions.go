package adminpg

import (
	"context"
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/fieldpermissionmapping"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/rolefieldpermission"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/userfieldpermission"
	"github.com/Ringyuki/shionlib/apps/api/internal/admin"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

type PermissionStore struct {
	client *ent.Client
}

func NewPermissionStore(client *ent.Client) *PermissionStore {
	return &PermissionStore{client: client}
}

func (s *PermissionStore) db(ctx context.Context) *ent.Client {
	return postgres.Client(ctx, s.client)
}

func (s *PermissionStore) RoleMask(ctx context.Context, role actor.Role, entity admin.PermissionEntity) (int64, error) {
	row, err := s.db(ctx).RoleFieldPermission.Query().
		Where(rolefieldpermission.Role(int(role)), rolefieldpermission.EntityEQ(rolefieldpermission.Entity(entity))).
		Only(ctx)
	if postgres.IsNotFound(err) {
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("load role permissions: %w", err)
	}
	return row.AllowMask, nil
}

func (s *PermissionStore) UserMask(ctx context.Context, userID int, entity admin.PermissionEntity) (int64, error) {
	row, err := s.db(ctx).UserFieldPermission.Query().
		Where(userfieldpermission.UserID(userID), userfieldpermission.EntityEQ(userfieldpermission.Entity(entity))).
		Only(ctx)
	if postgres.IsNotFound(err) {
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("load user permissions: %w", err)
	}
	return row.AllowMask, nil
}

func (s *PermissionStore) PermissionMappings(ctx context.Context, entity admin.PermissionEntity) ([]admin.PermissionMapping, error) {
	rows, err := s.db(ctx).FieldPermissionMapping.Query().
		Where(fieldpermissionmapping.EntityEQ(fieldpermissionmapping.Entity(entity))).
		Order(ent.Asc(fieldpermissionmapping.FieldBitIndex)).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("list permission mappings: %w", err)
	}
	mappings := make([]admin.PermissionMapping, len(rows))
	for i, row := range rows {
		mappings[i] = admin.PermissionMapping{Field: row.Field, BitIndex: row.BitIndex, IsRelation: row.IsRelation}
	}
	return mappings, nil
}

func (s *PermissionStore) SetUserMask(ctx context.Context, userID int, entity admin.PermissionEntity, mask int64) error {
	err := s.db(ctx).UserFieldPermission.Create().
		SetUserID(userID).
		SetEntity(userfieldpermission.Entity(entity)).
		SetAllowMask(mask).
		OnConflictColumns(userfieldpermission.FieldUserID, userfieldpermission.FieldEntity).
		UpdateAllowMask().
		UpdateUpdated().
		Exec(ctx)
	if postgres.IsForeignKeyViolation(err, "user_field_permissions_user_id_fkey") {
		return user.ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("store user permissions: %w", err)
	}
	return nil
}
