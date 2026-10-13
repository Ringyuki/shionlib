package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type RoleFieldPermission struct {
	ent.Schema
}

func (RoleFieldPermission) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("role_field_permissions")}
}

func (RoleFieldPermission) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Int("role").SchemaType(pg("integer")),
		field.Enum("entity").Values("game", "character", "developer").SchemaType(pgEnum("permission_entity")),
		field.Int64("allow_mask").Default(0),
		created(),
		updated(),
	}
}

func (RoleFieldPermission) Edges() []ent.Edge {
	return []ent.Edge{}
}

func (RoleFieldPermission) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("role", "entity").Unique().StorageKey("role_field_permissions_role_entity_key"),
		index.Fields("role", "entity").StorageKey("role_field_permissions_role_entity_idx"),
	}
}
