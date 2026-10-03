package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type UserFieldPermission struct {
	ent.Schema
}

func (UserFieldPermission) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("user_field_permissions")}
}

func (UserFieldPermission) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Int("user_id").SchemaType(pg("integer")),
		field.Enum("entity").Values("game", "character", "developer").SchemaType(pgEnum("permission_entity")),
		field.Int64("allow_mask").Default(0),
		created(),
		updated(),
	}
}

func (UserFieldPermission) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("user", User.Type).Ref("field_permissions").Field("user_id").Unique().Required(),
	}
}

func (UserFieldPermission) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("user_id", "entity").Unique().StorageKey("user_field_permissions_user_id_entity_key"),
		index.Fields("user_id", "entity").StorageKey("user_field_permissions_user_id_entity_idx"),
	}
}
