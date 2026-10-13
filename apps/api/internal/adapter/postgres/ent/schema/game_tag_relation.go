package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type GameTagRelation struct {
	ent.Schema
}

func (GameTagRelation) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("game_tag_relations"), field.ID("game_id", "tag_id")}
}

func (GameTagRelation) Fields() []ent.Field {
	return []ent.Field{
		field.Int("game_id").SchemaType(pg("integer")),
		field.Int("tag_id").SchemaType(pg("integer")),
		field.Text("tag_alias").Optional().Nillable(),
	}
}

func (GameTagRelation) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("game", Game.Type).Unique().Required().Field("game_id").StorageKey(edge.Symbol("game_tag_relations_game_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("tag", Tag.Type).Unique().Required().Field("tag_id").StorageKey(edge.Symbol("game_tag_relations_tag_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
	}
}

func (GameTagRelation) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("game_id", "tag_id").Unique().StorageKey("game_tag_relations_game_id_tag_id_key"),
		index.Fields("tag_id").StorageKey("game_tag_relations_tag_id_idx"),
	}
}
