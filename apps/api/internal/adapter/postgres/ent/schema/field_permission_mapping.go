package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type FieldPermissionMapping struct {
	ent.Schema
}

func (FieldPermissionMapping) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("field_permission_mappings")}
}

func (FieldPermissionMapping) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Enum("entity").Values("game", "character", "developer").SchemaType(pgEnum("permission_entity")),
		field.Text("field"),
		field.Int("bit_index").SchemaType(pg("integer")),
		field.Bool("is_relation").Default(false),
		created(),
		updated(),
	}
}

func (FieldPermissionMapping) Edges() []ent.Edge {
	return []ent.Edge{}
}

func (FieldPermissionMapping) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("entity", "field").Unique().StorageKey("field_permission_mappings_entity_field_key"),
		index.Fields("entity", "bit_index").Unique().StorageKey("field_permission_mappings_entity_bit_index_key"),
		index.Fields("entity").StorageKey("field_permission_mappings_entity_idx"),
	}
}
