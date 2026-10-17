package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type PatchPageAssignment struct {
	ent.Schema
}

func (PatchPageAssignment) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("patch_page_assignments")}
}

func (PatchPageAssignment) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Int("game_id").SchemaType(pg("integer")),
		field.Other("page_ids", stringsType).SchemaType(textArray).Optional().Annotations(emptyArray("text[]")),
		field.Int("assigned_by").SchemaType(pg("integer")).Optional().Nillable(),
		created(),
		updated(),
	}
}

func (PatchPageAssignment) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("game", Game.Type).Unique().Required().Field("game_id").StorageKey(edge.Symbol("patch_page_assignments_game_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("assigner", User.Type).Unique().Field("assigned_by").StorageKey(edge.Symbol("patch_page_assignments_assigned_by_fkey")).Annotations(entsql.OnDelete(entsql.SetNull)),
	}
}

func (PatchPageAssignment) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("game_id").Unique().StorageKey("patch_page_assignments_game_id_key"),
	}
}
