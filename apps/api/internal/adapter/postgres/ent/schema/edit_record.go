package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
)

type EditRecord struct {
	ent.Schema
}

func (EditRecord) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("edit_records")}
}

func (EditRecord) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Enum("entity").Values("game", "character", "developer").SchemaType(pgEnum("permission_entity")),
		field.Int("target_id").SchemaType(pg("integer")),
		field.Enum("action").Values("UPDATE_SCALAR", "ADD_RELATION", "REMOVE_RELATION", "SET_RELATION", "UPDATE_RELATION").SchemaType(pgEnum("edit_action_type")),
		field.Int("actor_id").SchemaType(pg("integer")),
		field.Int("actor_role").SchemaType(pg("integer")),
		field.Int64("field_mask").Default(0),
		field.Other("changed_fields", stringsType).SchemaType(textArray).Optional().StorageKey("field_changes"),
		field.JSON("changes", rawJSON).SchemaType(jsonbType).Optional(),
		field.Enum("relation_type").Values("cover", "image", "link", "developer", "character", "game_relation").SchemaType(pgEnum("edit_relation_type")).Optional().Nillable(),
		field.String("note").MaxLen(255).SchemaType(varchar(255)).Optional().Nillable(),
		field.Bool("undo").Default(false),
		field.Int("undo_of_id").SchemaType(pg("integer")).Unique().Optional().Nillable(),
		created(),
		updated(),
	}
}

func (EditRecord) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("activities", Activity.Type).StorageKey(edge.Symbol("activities_edit_record_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.From("actor", User.Type).Ref("edit_records").Field("actor_id").Unique().Required(),
		edge.To("undone_by", EditRecord.Type).Unique().StorageKey(edge.Symbol("edit_records_undo_of_id_fkey")).Annotations(entsql.OnDelete(entsql.SetNull)),
		edge.From("undo_of", EditRecord.Type).Ref("undone_by").Field("undo_of_id").Unique(),
	}
}

func (EditRecord) Indexes() []ent.Index {
	return []ent.Index{}
}
